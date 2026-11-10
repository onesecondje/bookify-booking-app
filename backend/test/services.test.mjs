import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { createApp } from '../src/app.ts';

test('GET business services HTTP contract', async (t) => {
  const schema = `bookify_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
    log: [],
  });
  const server = createApp(prisma).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(
      await readFile(new URL('../prisma/migrations/0_init/migration.sql', import.meta.url), 'utf8'),
    );
    const origin = `http://127.0.0.1:${server.address().port}`;
    const business = await prisma.business.create({
      data: { name: 'Studio', timeZone: 'Europe/Warsaw' },
    });
    const other = await prisma.business.create({
      data: { name: 'Other studio', timeZone: 'Europe/Kyiv' },
    });
    const empty = await prisma.business.create({
      data: { name: 'Empty studio', timeZone: 'Europe/Warsaw' },
    });
    const inactiveOnly = await prisma.business.create({
      data: { name: 'Inactive studio', timeZone: 'Europe/Warsaw' },
    });
    const first = {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Haircut',
      durationMinutes: 30,
    };
    const second = {
      id: '30000000-0000-4000-8000-000000000002',
      name: 'Haircut',
      durationMinutes: 45,
    };
    const beard = { id: randomUUID(), name: 'Beard trim', durationMinutes: 15 };
    await prisma.service.createMany({
      data: [
        { ...second, businessId: business.id },
        { ...first, businessId: business.id },
        { ...beard, businessId: business.id },
        { name: 'Inactive', durationMinutes: 90, businessId: business.id, isActive: false },
        { name: 'Other service', durationMinutes: 20, businessId: other.id },
        { name: 'Inactive', durationMinutes: 20, businessId: inactiveOnly.id, isActive: false },
      ],
    });
    const request = (id, query = '') =>
      globalThis.fetch(`${origin}/api/businesses/${id}/services${query}`);

    await t.test(
      'returns only active services of the requested business with stable ordering and public fields',
      async () => {
        for (const query of ['', '?isActive=false']) {
          const response = await request(business.id.toUpperCase(), query);
          assert.equal(response.status, 200);
          assert.match(response.headers.get('content-type'), /application\/json/);
          assert.deepEqual(await response.json(), { services: [beard, first, second] });
        }
      },
    );
    await t.test('returns an empty array for businesses with no active services', async () => {
      for (const id of [empty.id, inactiveOnly.id]) {
        const response = await request(id);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { services: [] });
      }
    });
    await t.test('rejects malformed UUIDs with 400', async () => {
      for (const id of ['not-a-uuid', '10000000-0000-4000-8000-00000000000z', '123']) {
        const response = await request(id);
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
          error: { code: 'INVALID_BUSINESS_ID', message: 'businessId must be a valid UUID.' },
        });
      }
    });
    await t.test('returns 404 for a valid UUID with no business', async () => {
      const response = await request(randomUUID());
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' },
      });
    });
    await t.test(
      'database failures use the generic error handler without leaking details',
      async (context) => {
        const log = context.mock.method(console, 'error', () => {});
        // Break only the isolated schema to exercise a real Prisma query failure.
        await pool.query('DROP TABLE services');
        const response = await request(business.id);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
        });
        assert.deepEqual(
          log.mock.calls.map((call) => call.arguments),
          [['Unhandled request error.']],
        );
      },
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    }
  }
});
