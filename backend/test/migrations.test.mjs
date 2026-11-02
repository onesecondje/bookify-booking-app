import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { pathToFileURL, URL } from 'node:url';
import { Pool } from 'pg';
import { runMigrations } from '../src/migrations.ts';

const migrationDirectory = new URL('../migrations/', import.meta.url);

async function withDatabase(check) {
  assert.ok(
    process.env.DATABASE_URL,
    'Set DATABASE_URL before running database integration tests.',
  );
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  // Only a generated test schema is created and removed; application tables are untouched.
  const schema = `bookify_test_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await check(pool, schema);
  } finally {
    await pool.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
}

async function withFixture(sql, check) {
  const directory = await mkdtemp(join(tmpdir(), 'bookify-migrations-'));
  const filename = join(directory, '0001_fixture.sql');
  try {
    await writeFile(filename, sql);
    await check(pathToFileURL(directory + '/'), filename);
  } finally {
    for (const name of await readdir(directory)) await unlink(join(directory, name));
    await rmdir(directory);
  }
}

test('initial migration is applied once and enforces business/service constraints', async () => {
  await withDatabase(async (pool) => {
    assert.deepEqual(await runMigrations(pool, migrationDirectory), [
      '0001_create_businesses_and_services.sql',
    ]);
    assert.deepEqual(await runMigrations(pool, migrationDirectory), []);
    const history = await pool.query('SELECT filename FROM schema_migrations');
    assert.equal(history.rowCount, 1);

    const { rows: businesses } = await pool.query(
      'INSERT INTO businesses (name, time_zone) VALUES ($1, $2) RETURNING id',
      ['Example Studio', 'Europe/Warsaw'],
    );
    const businessId = businesses[0].id;
    const { rows: services } = await pool.query(
      'INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING *',
      [businessId, 'Haircut', 30],
    );
    assert.equal(services[0].is_active, true);
    assert.equal(services[0].duration_minutes, 30);
    assert.ok(services[0].created_at instanceof Date);

    for (const duration of [0, -5]) {
      await assert.rejects(
        pool.query(
          'INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)',
          [businessId, 'Invalid duration', duration],
        ),
        { code: '23514' },
      );
    }
    await assert.rejects(
      pool.query('INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)', [
        randomUUID(),
        'Missing business',
        30,
      ]),
      { code: '23503' },
    );
    await assert.rejects(
      pool.query('INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)', [
        businessId,
        '   ',
        30,
      ]),
      { code: '23514' },
    );
    await assert.rejects(
      pool.query('INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)', [
        businessId,
        null,
        30,
      ]),
      { code: '23502' },
    );
    await assert.rejects(pool.query('DELETE FROM businesses WHERE id = $1', [businessId]), {
      code: '23001',
    });
  });
});

test('a failed migration rolls back schema changes and can be retried', async () => {
  await withDatabase(async (pool, schema) => {
    await withFixture(
      'CREATE TABLE rollback_probe (id integer); SELECT missing_column;',
      async (directory, filename) => {
        await assert.rejects(runMigrations(pool, directory), { code: '42703' });
        const tables = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', [
          schema,
        ]);
        assert.equal(tables.rowCount, 0);

        await writeFile(filename, 'CREATE TABLE rollback_probe (id integer);');
        assert.deepEqual(await runMigrations(pool, directory), ['0001_fixture.sql']);
      },
    );
  });
});

test('modifying an applied migration is rejected without changing history', async () => {
  await withDatabase(async (pool) => {
    await withFixture('CREATE TABLE checksum_probe (id integer);', async (directory, filename) => {
      await runMigrations(pool, directory);
      await writeFile(filename, 'CREATE TABLE checksum_probe (id integer, changed text);');
      await assert.rejects(runMigrations(pool, directory), /Migration history mismatch/);
      const history = await pool.query('SELECT * FROM schema_migrations');
      assert.equal(history.rowCount, 1);
    });
  });
});

test('concurrent runners serialize and record each migration once', async () => {
  await withDatabase(async (pool) => {
    const results = await Promise.all([
      runMigrations(pool, migrationDirectory),
      runMigrations(pool, migrationDirectory),
    ]);
    assert.deepEqual(results.map((files) => files.length).sort(), [0, 1]);
    assert.equal((await pool.query('SELECT * FROM schema_migrations')).rowCount, 1);
  });
});
