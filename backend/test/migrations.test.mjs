import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

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

test('bookings retain their intervals and atomically prevent active specialist overlaps', async () => {
  await withDatabase(async (pool, schema) => {
    await migrate(schema, 'deploy');
    const prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
      log: [],
    });
    try {
      const business = await prisma.business.create({
        data: { name: 'Booking Studio', timeZone: 'Europe/Warsaw' },
      });
      const otherBusiness = await prisma.business.create({
        data: { name: 'Other Studio', timeZone: 'Europe/Warsaw' },
      });
      const addSpecialist = (name, businessId = business.id) =>
        prisma.specialist.create({ data: { businessId, name } });
      const addService = (name, businessId = business.id) =>
        prisma.service.create({ data: { businessId, name, durationMinutes: 30 } });
      const alice = await addSpecialist('Alice');
      const alex = await addSpecialist('Alex');
      const foreignSpecialist = await addSpecialist('Bob', otherBusiness.id);
      const haircut = await addService('Haircut');
      const trim = await addService('Beard trim');
      const foreignService = await addService('Haircut', otherBusiness.id);
      const insert = (specialistId, serviceId, startsAt, endsAt, connection = pool) =>
        connection.query(
          'INSERT INTO bookings (business_id, specialist_id, service_id, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [business.id, specialistId, serviceId, startsAt, endsAt],
        );
      const original = await prisma.booking.create({
        data: {
          businessId: business.id,
          specialistId: alice.id,
          serviceId: haircut.id,
          startsAt: new Date('2099-01-05T09:00:00+01:00'),
          endsAt: new Date('2099-01-05T09:30:00+01:00'),
        },
      });
      const start = original.startsAt.toISOString();
      const end = original.endsAt.toISOString();
      assert.equal(start, '2099-01-05T08:00:00.000Z');
      assert.equal(end, '2099-01-05T08:30:00.000Z');
      assert.equal(original.cancelledAt, null);
      await insert(alice.id, trim.id, end, '2099-01-05T09:00:00Z');
      await insert(alex.id, haircut.id, start, end);
      await assert.rejects(insert(alice.id, trim.id, start, end), { code: '23P01' });
      await assert.rejects(
        insert(alice.id, trim.id, '2099-01-05T08:15:00Z', '2099-01-05T08:45:00Z'),
        { code: '23P01' },
      );
      await assert.rejects(insert(alice.id, trim.id, start, start), { code: '23514' });
      await assert.rejects(insert(alice.id, trim.id, end, start), { code: '23514' });
      await assert.rejects(insert(alice.id, trim.id, start, 'infinity'), { code: '23514' });
      await assert.rejects(insert(foreignSpecialist.id, trim.id, start, end), { code: '23503' });
      await assert.rejects(insert(alex.id, foreignService.id, end, '2099-01-05T09:00:00Z'), {
        code: '23503',
      });

      await prisma.service.update({ where: { id: haircut.id }, data: { durationMinutes: 45 } });
      const cancelled = await prisma.booking.update({
        where: { id: original.id },
        data: { cancelledAt: new Date() },
      });
      assert.equal(cancelled.endsAt.toISOString(), end);
      await insert(alice.id, trim.id, start, end);
      await assert.rejects(
        pool.query('UPDATE bookings SET cancelled_at = NULL WHERE id = $1', [original.id]),
        { code: '23P01' },
      );

      const raceStart = '2099-01-05T10:00:00Z';
      const first = await pool.connect();
      const second = await pool.connect();
      try {
        await first.query('BEGIN');
        await second.query('BEGIN');
        await second.query("SET LOCAL statement_timeout = '5s'");
        const {
          rows: [{ pid }],
        } = await second.query('SELECT pg_backend_pid() AS pid');
        await insert(alice.id, haircut.id, raceStart, '2099-01-05T10:30:00Z', first);
        const conflict = assert.rejects(
          insert(alice.id, trim.id, '2099-01-05T10:15:00Z', '2099-01-05T10:45:00Z', second),
          { code: '23P01', constraint: 'bookings_no_active_overlap' },
        );
        // Keep cleanup safe even if the blocking assertion fails.
        void conflict.catch(() => {});
        let blocking = false;
        for (let attempt = 0; attempt < 100 && !blocking; attempt++) {
          const { rows } = await first.query(
            'SELECT pg_backend_pid() = ANY(pg_blocking_pids($1)) AS blocking',
            [pid],
          );
          blocking = rows[0].blocking;
          if (!blocking) await delay(10);
        }
        assert.ok(blocking, 'The competing insert must wait on the uncommitted booking');
        await first.query('COMMIT');
        await conflict;
      } finally {
        await first.query('ROLLBACK');
        await second.query('ROLLBACK');
        first.release();
        second.release();
      }
      assert.equal(
        await prisma.booking.count({
          where: { specialistId: alice.id, startsAt: { gte: new Date(raceStart) } },
        }),
        1,
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});

test('Prisma deploy is repeatable and preserves database constraints and defaults', async () => {
  await withDatabase(async (pool, schema) => {
    await migrate(schema, 'deploy');
    await migrate(schema, 'deploy');
    const history = await pool.query('SELECT migration_name, finished_at FROM _prisma_migrations');
    assert.deepEqual(history.rows.map((row) => row.migration_name).sort(), [
      '0_init',
      '20261110000100_add_specialists_and_service_assignments',
      '20261112000100_add_specialist_working_periods',
      '20261118000100_add_bookings',
    ]);
    assert.ok(history.rows.every((row) => row.finished_at));
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
    assert.equal((await pool.query('SELECT * FROM _prisma_migrations')).rowCount, 4);
  });
});

test('specialist assignments support many-to-many relations and enforce business boundaries', async () => {
  await withDatabase(async (pool, schema) => {
    await migrate(schema, 'deploy');
    const prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
      log: [],
    });
    try {
      const a = await prisma.business.create({
        data: { name: 'Studio A', timeZone: 'Europe/Warsaw' },
      });
      const b = await prisma.business.create({
        data: { name: 'Studio B', timeZone: 'Europe/Warsaw' },
      });
      const alice = await prisma.specialist.create({ data: { name: 'Alice', businessId: a.id } });
      const alex = await prisma.specialist.create({ data: { name: 'Alex', businessId: a.id } });
      const bob = await prisma.specialist.create({ data: { name: 'Bob', businessId: b.id } });
      const haircut = await prisma.service.create({
        data: { name: 'Haircut', businessId: a.id, durationMinutes: 30 },
      });
      const trim = await prisma.service.create({
        data: { name: 'Trim', businessId: a.id, durationMinutes: 15 },
      });
      const foreignService = await prisma.service.create({
        data: { name: 'Other service', businessId: b.id, durationMinutes: 30 },
      });
      assert.match(alice.id, /^[0-9a-f-]{36}$/);
      assert.equal(alice.isActive, true);
      assert.ok(alice.createdAt instanceof Date);

      await prisma.specialistService.createMany({
        data: [
          { businessId: a.id, specialistId: alice.id, serviceId: haircut.id },
          { businessId: a.id, specialistId: alice.id, serviceId: trim.id },
          { businessId: a.id, specialistId: alex.id, serviceId: haircut.id },
        ],
      });
      const specialist = await prisma.specialist.findUniqueOrThrow({
        where: { businessId_id: { businessId: a.id, id: alice.id } },
        include: { services: { include: { service: true } } },
      });
      assert.deepEqual(specialist.services.map((assignment) => assignment.service.name).sort(), [
        'Haircut',
        'Trim',
      ]);
      assert.ok(specialist.services.every((assignment) => assignment.createdAt instanceof Date));
      assert.equal(
        (
          await prisma.service.findUniqueOrThrow({
            where: { id: haircut.id },
            include: { specialists: true },
          })
        ).specialists.length,
        2,
      );

      const assign = (businessId, specialistId, serviceId) =>
        pool.query(
          'INSERT INTO specialist_services (business_id, specialist_id, service_id) VALUES ($1, $2, $3)',
          [businessId, specialistId, serviceId],
        );
      await assert.rejects(assign(a.id, alice.id, haircut.id), { code: '23505' });
      for (const ids of [
        [a.id, alice.id, foreignService.id],
        [a.id, bob.id, haircut.id],
        [b.id, alice.id, haircut.id],
        [a.id, randomUUID(), haircut.id],
        [a.id, alice.id, randomUUID()],
      ]) {
        await assert.rejects(assign(...ids), { code: '23503' });
      }
      await assert.rejects(assign(null, alice.id, haircut.id), { code: '23502' });
      await assert.rejects(assign(a.id, null, haircut.id), { code: '23502' });
      await assert.rejects(assign(a.id, alice.id, null), { code: '23502' });
      await assert.rejects(
        pool.query('INSERT INTO specialists (business_id, name) VALUES ($1, $2)', [a.id, '   ']),
        { code: '23514' },
      );
      await assert.rejects(
        pool.query('INSERT INTO specialists (business_id, name) VALUES ($1, $2)', [a.id, null]),
        { code: '23502' },
      );
      await assert.rejects(
        pool.query('INSERT INTO specialists (business_id, name) VALUES ($1, $2)', [
          randomUUID(),
          'Missing business',
        ]),
        { code: '23503' },
      );
      await assert.rejects(pool.query('DELETE FROM specialists WHERE id = $1', [alice.id]), {
        code: '23001',
      });
      await assert.rejects(pool.query('DELETE FROM services WHERE id = $1', [haircut.id]), {
        code: '23001',
      });
      await assert.rejects(pool.query('DELETE FROM businesses WHERE id = $1', [b.id]), {
        code: '23001',
      });
      await assert.rejects(
        pool.query('UPDATE specialists SET business_id = $1 WHERE id = $2', [b.id, alice.id]),
        { code: '23503' },
      );
      await assert.rejects(
        pool.query('UPDATE services SET business_id = $1 WHERE id = $2', [b.id, haircut.id]),
        { code: '23503' },
      );
      await prisma.specialist.update({ where: { id: alice.id }, data: { isActive: false } });
      assert.equal(await prisma.specialistService.count(), 3);
      const indexes = await pool.query(
        'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2',
        [schema, 'specialist_services'],
      );
      assert.deepEqual(indexes.rows.map((row) => row.indexname).sort(), [
        'specialist_services_business_id_service_id_idx',
        'specialist_services_pkey',
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });
});

test('weekly working periods enforce bounds, ownership and atomic non-overlap', async () => {
  await withDatabase(async (pool, schema) => {
    // Upgrade an existing specialist dataset, rather than only testing an empty database.
    await pool.query(baseline);
    await pool.query(
      await readFile(
        new URL(
          '../prisma/migrations/20261110000100_add_specialists_and_service_assignments/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
      log: [],
    });
    try {
      const a = await prisma.business.create({
        data: { name: 'Studio A', timeZone: 'Europe/Warsaw' },
      });
      const b = await prisma.business.create({
        data: { name: 'Studio B', timeZone: 'Europe/Warsaw' },
      });
      const alice = await prisma.specialist.create({ data: { businessId: a.id, name: 'Alice' } });
      const alex = await prisma.specialist.create({ data: { businessId: a.id, name: 'Alex' } });
      const bob = await prisma.specialist.create({ data: { businessId: b.id, name: 'Bob' } });
      const service = await prisma.service.create({
        data: { businessId: a.id, name: 'Haircut', durationMinutes: 30 },
      });
      await prisma.specialistService.create({
        data: { businessId: a.id, specialistId: alice.id, serviceId: service.id },
      });
      const tables = ['businesses', 'services', 'specialists', 'specialist_services'];
      const before = await Promise.all(
        tables.map(async (table) => ({
          rows: (await pool.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows,
          oid: (await pool.query('SELECT $1::regclass::oid AS oid', [table])).rows,
        })),
      );
      await migrate(schema, 'resolve', '--applied', '0_init');
      await migrate(
        schema,
        'resolve',
        '--applied',
        '20261110000100_add_specialists_and_service_assignments',
      );
      await migrate(schema, 'deploy');
      for (const [index, table] of tables.entries()) {
        assert.deepEqual(
          (await pool.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows,
          before[index].rows,
        );
        assert.deepEqual(
          (await pool.query('SELECT $1::regclass::oid AS oid', [table])).rows,
          before[index].oid,
        );
      }

      const insert = (businessId, specialistId, weekday, start, end, connection = pool) =>
        connection.query(
          'INSERT INTO specialist_working_periods (business_id, specialist_id, weekday, start_minute, end_minute) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [businessId, specialistId, weekday, start, end],
        );
      const morning = await prisma.specialistWorkingPeriod.create({
        data: {
          businessId: a.id,
          specialistId: alice.id,
          weekday: 1,
          startMinute: 540,
          endMinute: 780,
        },
      });
      assert.match(morning.id, /^[0-9a-f-]{36}$/);
      assert.ok(morning.createdAt instanceof Date);
      await insert(a.id, alice.id, 1, 780, 840); // Adjacent periods are allowed.
      await insert(a.id, alice.id, 1, 900, 1080); // A break between periods is allowed.
      await insert(a.id, alice.id, 2, 0, 1440); // Full local day and another weekday.
      await insert(a.id, alex.id, 1, 540, 780);
      await insert(b.id, bob.id, 1, 540, 780);
      const related = await prisma.specialist.findUniqueOrThrow({
        where: { id: alice.id },
        select: { workingPeriods: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
      });
      assert.deepEqual(
        related.workingPeriods.map((p) => [p.weekday, p.startMinute, p.endMinute]),
        [
          [1, 540, 780],
          [1, 780, 840],
          [1, 900, 1080],
          [2, 0, 1440],
        ],
      );
      for (const [start, end] of [
        [540, 780],
        [600, 660],
        [500, 600],
        [700, 800],
        [500, 1100],
      ]) {
        await assert.rejects(insert(a.id, alice.id, 1, start, end), { code: '23P01' });
      }
      for (const [day, start, end] of [
        [0, 540, 780],
        [8, 540, 780],
        [1, -1, 10],
        [1, 10, 10],
        [1, 20, 10],
        [1, 1400, 1441],
      ]) {
        await assert.rejects(insert(a.id, alice.id, day, start, end), { code: '23514' });
      }
      for (const values of [
        [null, alice.id, 3, 540, 780],
        [a.id, null, 3, 540, 780],
        [a.id, alice.id, null, 540, 780],
        [a.id, alice.id, 3, null, 780],
        [a.id, alice.id, 3, 540, null],
      ]) {
        await assert.rejects(insert(...values), { code: '23502' });
      }
      await assert.rejects(insert(a.id, bob.id, 1, 540, 780), { code: '23503' });
      await assert.rejects(insert(b.id, alice.id, 1, 540, 780), { code: '23503' });
      await assert.rejects(insert(a.id, randomUUID(), 1, 540, 780), { code: '23503' });
      await assert.rejects(
        pool.query(
          'UPDATE specialist_working_periods SET start_minute = 700 WHERE business_id = $1 AND start_minute = 900',
          [a.id],
        ),
        { code: '23P01' },
      );
      await assert.rejects(pool.query('DELETE FROM specialists WHERE id = $1', [alex.id]), {
        code: '23001',
      });
      await assert.rejects(
        pool.query('UPDATE specialists SET business_id = $1 WHERE id = $2', [b.id, alex.id]),
        { code: '23503' },
      );
      await prisma.specialist.update({ where: { id: alice.id }, data: { isActive: false } });
      assert.equal(
        await prisma.specialistWorkingPeriod.count({ where: { specialistId: alice.id } }),
        4,
      );

      const first = await pool.connect();
      const second = await pool.connect();
      try {
        await first.query('BEGIN');
        await first.query("SET LOCAL statement_timeout = '5s'");
        await second.query("SET statement_timeout = '5s'");
        await insert(a.id, alex.id, 3, 540, 600, first);
        const conflict = assert.rejects(insert(a.id, alex.id, 3, 570, 630, second), {
          code: '23P01',
        });
        await first.query('COMMIT');
        await conflict;
      } finally {
        await first.query('ROLLBACK');
        first.release();
        second.release();
      }
      assert.equal(
        await prisma.specialistWorkingPeriod.count({
          where: { specialistId: alex.id, weekday: 3 },
        }),
        1,
      );
      const index = await pool.query(
        'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
        [schema, 'specialist_working_periods_lookup_idx'],
      );
      assert.match(index.rows[0].indexdef, /\(business_id, specialist_id, weekday, start_minute\)/);
    } finally {
      await prisma.$disconnect();
    }
  });
});
