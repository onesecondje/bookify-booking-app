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

test('GET service specialists HTTP contract', async (t) => {
  const schema = `bookify_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
    connectionTimeoutMillis: 5000,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
    log: [],
  });
  const server = createApp(prisma).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    for (const migration of ['0_init', '20261110000100_add_specialists_and_service_assignments']) {
      await pool.query(
        await readFile(
          new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
          'utf8',
        ),
      );
    }
    const business = await prisma.business.create({
      data: { name: 'Studio', timeZone: 'Europe/Warsaw' },
    });
    const other = await prisma.business.create({
      data: { name: 'Other', timeZone: 'Europe/Kyiv' },
    });
    const makeService = (businessId, name, isActive = true) =>
      prisma.service.create({
        data: { businessId, name, isActive, durationMinutes: 30 },
      });
    const service = await makeService(business.id, 'Haircut');
    const empty = await makeService(business.id, 'Unassigned');
    const inactiveOnly = await makeService(business.id, 'Inactive specialists only');
    const inactive = await makeService(business.id, 'Inactive service', false);
    const foreign = await makeService(other.id, 'Other service');
    const first = { id: '30000000-0000-4000-8000-000000000001', name: 'Alice' };
    const second = { id: '30000000-0000-4000-8000-000000000002', name: 'Alice' };
    const alex = { id: randomUUID(), name: 'Alex' };
    const disabled = { id: randomUUID(), name: 'Aaron', isActive: false };
    const unassigned = { id: randomUUID(), name: 'Abby' };
    await prisma.specialist.createMany({
      data: [second, first, alex, disabled, unassigned].map((item) => ({
        ...item,
        businessId: business.id,
      })),
    });
    const foreignSpecialist = await prisma.specialist.create({
      data: { businessId: other.id, name: 'Other specialist' },
    });
    await prisma.specialistService.createMany({
      data: [
        ...[second, first, alex, disabled].map((item) => ({
          businessId: business.id,
          serviceId: service.id,
          specialistId: item.id,
        })),
        { businessId: business.id, serviceId: inactiveOnly.id, specialistId: disabled.id },
        { businessId: business.id, serviceId: inactive.id, specialistId: first.id },
        { businessId: business.id, serviceId: inactive.id, specialistId: unassigned.id },
        { businessId: other.id, serviceId: foreign.id, specialistId: foreignSpecialist.id },
      ],
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = (businessId = business.id, serviceId = service.id, query = '') =>
      globalThis.fetch(
        `${origin}/api/businesses/${businessId}/services/${serviceId}/specialists${query}`,
      );
    const expectError = async (response, status, code, message) => {
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: { code, message } });
    };

    await t.test(
      'filters by business, assignment and active status, orders ties and selects public fields',
      async () => {
        for (const query of ['', '?isActive=false']) {
          const response = await request(
            business.id.toUpperCase(),
            service.id.toUpperCase(),
            query,
          );
          assert.equal(response.status, 200);
          assert.match(response.headers.get('content-type'), /application\/json/);
          assert.deepEqual(await response.json(), { specialists: [alex, first, second] });
        }
        const response = await request(other.id, foreign.id);
        assert.deepEqual(await response.json(), {
          specialists: [{ id: foreignSpecialist.id, name: foreignSpecialist.name }],
        });
      },
    );
    await t.test(
      'returns empty lists for no assignments or only inactive specialists',
      async () => {
        for (const id of [empty.id, inactiveOnly.id]) {
          const response = await request(business.id, id);
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { specialists: [] });
        }
      },
    );
    await t.test(
      'validates both UUIDs before lookups, with business UUID taking priority',
      async () => {
        for (const value of [
          'invalid',
          '10000000000040008000000000000001',
          '10000000-0000-4000-8000-00000000000z',
        ]) {
          await expectError(
            await request(value, value),
            400,
            'INVALID_BUSINESS_ID',
            'businessId must be a valid UUID.',
          );
          await expectError(
            await request(randomUUID(), value),
            400,
            'INVALID_SERVICE_ID',
            'serviceId must be a valid UUID.',
          );
        }
      },
    );
    await t.test(
      'distinguishes missing businesses from missing, inactive and foreign services',
      async () => {
        await expectError(
          await request(randomUUID()),
          404,
          'BUSINESS_NOT_FOUND',
          'Business not found.',
        );
        for (const id of [randomUUID(), inactive.id, foreign.id]) {
          await expectError(
            await request(business.id, id),
            404,
            'SERVICE_NOT_FOUND',
            'Service not found.',
          );
        }
      },
    );
    await t.test('deactivation hides a specialist without deleting assignments', async () => {
      await prisma.specialist.update({ where: { id: alex.id }, data: { isActive: false } });
      const response = await request();
      assert.deepEqual(await response.json(), { specialists: [first, second] });
      assert.equal(await prisma.specialistService.count({ where: { specialistId: alex.id } }), 1);
    });
    await t.test(
      'database failures stay generic and UUID validation needs no database query',
      async (context) => {
        const log = context.mock.method(console, 'error', () => {});
        await pool.query('DROP TABLE specialist_services');
        await expectError(
          await request(business.id, 'invalid'),
          400,
          'INVALID_SERVICE_ID',
          'serviceId must be a valid UUID.',
        );
        await expectError(
          await request('invalid'),
          400,
          'INVALID_BUSINESS_ID',
          'businessId must be a valid UUID.',
        );
        assert.equal(log.mock.calls.length, 0);
        await expectError(
          await request(),
          500,
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred.',
        );
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
