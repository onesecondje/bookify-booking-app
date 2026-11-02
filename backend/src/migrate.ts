import { pool } from './db.js';
import { runMigrations } from './migrations.js';

try {
  const applied = await runMigrations(pool);
  for (const filename of applied) console.log(`Applied migration: ${filename}`);
  console.log(applied.length ? 'Migrations committed.' : 'Database is up to date.');
} catch (error) {
  // Do not print driver error details, which can contain connection or row data.
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
  console.error(`Migration failed (${code}). No pending migrations were committed.`);
  if (error instanceof Error && !('code' in error)) console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
