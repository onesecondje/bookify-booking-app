import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const execute = promisify(execFile);
const baseline = await readFile(
  new URL('../prisma/migrations/0_init/migration.sql', import.meta.url),
  'utf8',
);

async function migrate(schema, ...args) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  try {
    await execute(process.execPath, [prismaCli, 'migrate', ...args], {
      cwd: backendDirectory,
      env: { ...process.env, DATABASE_URL: url.href },
      timeout: 30000,
    });
  } catch {
    // CLI diagnostics may include connection details or database values.
    throw new Error('Prisma migration command failed in the isolated test schema.');
  }
}

async function withDatabase(check) {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL before running integration tests.');
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
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
      // Only this generated test schema is removed; application data is untouched.
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
}

test('Prisma deploy is repeatable and preserves database constraints and defaults', async () => {
  await withDatabase(async (pool, schema) => {
    await migrate(schema, 'deploy');
    await migrate(schema, 'deploy');
    const history = await pool.query('SELECT migration_name, finished_at FROM _prisma_migrations');
    assert.equal(history.rowCount, 1);
    assert.equal(history.rows[0].migration_name, '0_init');
    assert.ok(history.rows[0].finished_at);
    const { rows: businesses } = await pool.query(
      'INSERT INTO businesses (name, time_zone) VALUES ($1, $2) RETURNING *',
      ['Example Studio', 'Europe/Warsaw'],
    );
    const businessId = businesses[0].id;
    assert.match(businessId, /^[0-9a-f-]{36}$/);
    assert.ok(businesses[0].created_at instanceof Date);
    const { rows: services } = await pool.query(
      'INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING *',
      [businessId, 'Haircut', 30],
    );
    assert.equal(services[0].is_active, true);
    assert.ok(services[0].created_at instanceof Date);
    for (const [name, zone] of [
      ['   ', 'Europe/Warsaw'],
      ['Studio', '   '],
    ]) {
      await assert.rejects(
        pool.query('INSERT INTO businesses (name, time_zone) VALUES ($1, $2)', [name, zone]),
        { code: '23514' },
      );
    }
    for (const duration of [0, -5]) {
      await assert.rejects(
        pool.query(
          'INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)',
          [businessId, 'Invalid', duration],
        ),
        { code: '23514' },
      );
    }
    for (const [id, name, code] of [
      [randomUUID(), 'Missing business', '23503'],
      [businessId, '   ', '23514'],
      [businessId, null, '23502'],
    ]) {
      await assert.rejects(
        pool.query(
          'INSERT INTO services (business_id, name, duration_minutes) VALUES ($1, $2, $3)',
          [id, name, 30],
        ),
        { code },
      );
    }
    await assert.rejects(pool.query('DELETE FROM businesses WHERE id = $1', [businessId]), {
      code: '23001',
    });
    await assert.rejects(
      pool.query('UPDATE businesses SET id = $1 WHERE id = $2', [randomUUID(), businessId]),
      { code: '23503' },
    );
    const index = await pool.query(
      'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
      [schema, 'services_business_id_idx'],
    );
    assert.equal(index.rowCount, 1);
    assert.match(index.rows[0].indexdef, /USING btree \(business_id\)/);
  });
});

test('baselining existing tables preserves records and does not recreate tables', async () => {
  await withDatabase(async (pool, schema) => {
    await pool.query(baseline);
    await pool.query(
      "INSERT INTO businesses (name, time_zone) VALUES ('Existing Studio', 'Europe/Warsaw')",
    );
    await pool.query(
      "INSERT INTO services (business_id, name, duration_minutes) SELECT id, 'Existing service', 30 FROM businesses",
    );
    const before = (await pool.query('SELECT * FROM services')).rows;
    const tableBefore = (await pool.query("SELECT 'services'::regclass::oid AS oid")).rows;
    await migrate(schema, 'resolve', '--applied', '0_init');
    await migrate(schema, 'deploy');
    await migrate(schema, 'status');
    assert.deepEqual((await pool.query('SELECT * FROM services')).rows, before);
    assert.deepEqual(
      (await pool.query("SELECT 'services'::regclass::oid AS oid")).rows,
      tableBefore,
    );
    assert.equal((await pool.query('SELECT * FROM businesses')).rowCount, 1);
    assert.equal((await pool.query('SELECT * FROM _prisma_migrations')).rowCount, 1);
  });
});
