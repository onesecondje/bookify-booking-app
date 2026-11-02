import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

type AppliedMigration = { filename: string; checksum: string };

export async function runMigrations(
  pool: Pool,
  directory = new URL('../migrations/', import.meta.url),
): Promise<string[]> {
  const filenames = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const versions = new Set<string>();
  const migrations = [];

  for (const filename of filenames) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(filename) || versions.has(filename.slice(0, 4))) {
      throw new Error(
        'Migration filenames must have unique four-digit versions and snake_case names.',
      );
    }
    versions.add(filename.slice(0, 4));

    // Normalize Windows line endings so Git checkout settings do not change checksums.
    const sql = (await readFile(new URL(filename, directory), 'utf8')).replace(/\r\n/g, '\n');
    migrations.push({ filename, sql, checksum: createHash('sha256').update(sql).digest('hex') });
  }

  // All transaction statements must use the same checked-out connection.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '30s'");
    // Serialize migration runners; the transaction releases this lock automatically.
    await client.query('SELECT pg_advisory_xact_lock(76429761)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows: applied } = await client.query<AppliedMigration>(
      'SELECT filename, checksum FROM schema_migrations ORDER BY filename',
    );

    for (const [index, previous] of applied.entries()) {
      const current = migrations[index];
      if (current?.filename !== previous.filename || current.checksum !== previous.checksum) {
        throw new Error(
          'Migration history mismatch. Restore applied files and append new migrations.',
        );
      }
    }

    const pending = migrations.slice(applied.length);
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
        migration.filename,
        migration.checksum,
      ]);
    }

    await client.query('COMMIT');
    return pending.map((migration) => migration.filename);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
