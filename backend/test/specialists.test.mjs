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

test('Specialist selection, availability and booking HTTP contracts', async (t) => {
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
    for (const migration of [
      '0_init',
      '20261110000100_add_specialists_and_service_assignments',
      '20261112000100_add_specialist_working_periods',
      '20261118000100_add_bookings',
      '20261119000100_add_booking_customer_contact',
    ]) {
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
      'availability returns scoped schedule slots and validates request inputs',
      async () => {
        const date = '2099-01-05';
        await prisma.specialistWorkingPeriod.create({
          data: {
            businessId: business.id,
            specialistId: first.id,
            weekday: 1,
            startMinute: 540,
            endMinute: 585,
          },
        });
        const availability = (
          specialistId = first.id,
          serviceId = service.id,
          businessId = business.id,
          query = `date=${date}`,
        ) => request(businessId, serviceId, `/${specialistId}/availability?${query}`);

        const response = await availability();
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          date,
          timeZone: 'Europe/Warsaw',
          unresolvedPeriodCount: 0,
          slots: [
            { startsAt: `${date}T08:00:00Z`, endsAt: `${date}T08:30:00Z` },
            { startsAt: `${date}T08:15:00Z`, endsAt: `${date}T08:45:00Z` },
          ],
        });
        for (const emptyResponse of [
          await availability(second.id),
          await availability(first.id, service.id, business.id, 'date=2099-01-06'),
          await availability(first.id, service.id, business.id, 'date=2000-01-03'),
        ]) {
          assert.equal(emptyResponse.status, 200);
          assert.deepEqual((await emptyResponse.json()).slots, []);
        }
        for (const [errorResponse, status, code] of [
          [await availability('invalid'), 400, 'INVALID_SPECIALIST_ID'],
          [await availability(first.id, 'invalid'), 400, 'INVALID_SERVICE_ID'],
          [await availability(first.id, service.id, 'invalid'), 400, 'INVALID_BUSINESS_ID'],
          [await availability(first.id, service.id, randomUUID()), 404, 'BUSINESS_NOT_FOUND'],
          [await availability(first.id, foreign.id), 404, 'SERVICE_NOT_FOUND'],
          [await availability(first.id, inactive.id), 404, 'SERVICE_NOT_FOUND'],
          ...(await Promise.all(
            [unassigned.id, disabled.id, foreignSpecialist.id].map(async (id) => [
              await availability(id),
              404,
              'SPECIALIST_NOT_FOUND',
            ]),
          )),
        ]) {
          assert.equal(errorResponse.status, status);
          assert.equal((await errorResponse.json()).error.code, code);
        }
        for (const query of ['', 'date=2099-02-30', `date=${date}&date=${date}`]) {
          await expectError(
            await availability(first.id, service.id, business.id, query),
            400,
            'INVALID_DATE',
            'date must be a valid YYYY-MM-DD date.',
          );
        }
      },
    );

    await t.test(
      'availability removes overlapping active bookings until cancellation',
      async () => {
        const date = '2099-01-07';
        const otherService = await makeService(business.id, 'Other assigned service');
        await prisma.specialistService.create({
          data: { businessId: business.id, specialistId: first.id, serviceId: otherService.id },
        });
        await prisma.specialistWorkingPeriod.create({
          data: {
            businessId: business.id,
            specialistId: first.id,
            weekday: 3,
            startMinute: 525,
            endMinute: 615,
          },
        });
        const time = (clock) => `${date}T${clock}:00Z`;
        const getStarts = async () => {
          const response = await request(
            business.id,
            service.id,
            `/${first.id}/availability?date=${date}`,
          );
          assert.equal(response.status, 200);
          const availability = await response.json();
          assert.equal(availability.timeZone, 'Europe/Warsaw');
          assert.equal(availability.unresolvedPeriodCount, 0);
          return availability.slots.map(({ startsAt }) => startsAt);
        };
        const create = (specialistId, serviceId, startsAt, endsAt) =>
          prisma.booking.create({
            data: {
              businessId: business.id,
              specialistId,
              serviceId,
              startsAt: new Date(startsAt),
              endsAt: new Date(endsAt),
            },
          });
        const expected = ['07:45', '08:00', '08:15', '08:30', '08:45'].map(time);
        assert.deepEqual(await getStarts(), expected);
        const otherSpecialistBooking = await create(
          second.id,
          service.id,
          time('07:45'),
          time('09:15'),
        );
        const blocking = await create(first.id, otherService.id, time('08:15'), time('08:45'));
        assert.deepEqual(await getStarts(), ['07:45', '08:45'].map(time));

        await prisma.booking.update({
          where: { id: blocking.id },
          data: { cancelledAt: new Date() },
        });
        assert.deepEqual(await getStarts(), expected);
        const overnight = await create(
          first.id,
          otherService.id,
          '2099-01-06T23:30:00Z',
          time('09:15'),
        );
        assert.deepEqual(await getStarts(), []);

        await prisma.booking.deleteMany({
          where: { id: { in: [otherSpecialistBooking.id, blocking.id, overnight.id] } },
        });
      },
    );

    await t.test('creates a server-validated booking and maps overlaps to HTTP 409', async () => {
      const date = '2099-01-06';
      const startsAt = `${date}T08:00:00Z`;
      const body = {
        date,
        startsAt,
        customerName: '  Example Customer  ',
        customerPhone: '+1 (202) 555-0123',
      };
      await prisma.specialistWorkingPeriod.create({
        data: {
          businessId: business.id,
          specialistId: first.id,
          weekday: 2,
          startMinute: 540,
          endMinute: 720,
        },
      });
      const book = (
        payload = body,
        specialistId = first.id,
        serviceId = service.id,
        businessId = business.id,
      ) =>
        globalThis.fetch(
          `${origin}/api/businesses/${businessId}/services/${serviceId}/specialists/${specialistId}/bookings`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
      for (const [response, status, code] of [
        [await book([]), 400, 'INVALID_BOOKING_BODY'],
        [await book({ ...body, date: '2099-02-29' }), 400, 'INVALID_DATE'],
        [await book({ date }), 400, 'INVALID_STARTS_AT'],
        [await book({ ...body, customerName: undefined }), 400, 'INVALID_CUSTOMER_NAME'],
        [await book({ ...body, customerName: '   ' }), 400, 'INVALID_CUSTOMER_NAME'],
        [await book({ ...body, customerName: 'x'.repeat(101) }), 400, 'INVALID_CUSTOMER_NAME'],
        [await book({ ...body, customerPhone: undefined }), 400, 'INVALID_CUSTOMER_PHONE'],
        [await book({ ...body, customerPhone: 2025550123 }), 400, 'INVALID_CUSTOMER_PHONE'],
        [await book({ ...body, customerPhone: '12345' }), 400, 'INVALID_CUSTOMER_PHONE'],
        [await book({ ...body, customerPhone: '1234567890123456' }), 400, 'INVALID_CUSTOMER_PHONE'],
        [await book({ ...body, customerPhone: '2025550123 ext 1' }), 400, 'INVALID_CUSTOMER_PHONE'],
        [await book({ ...body, startsAt: `${date}T09:00:00+01:00` }), 400, 'INVALID_STARTS_AT'],
        [await book(body, 'bad'), 400, 'INVALID_SPECIALIST_ID'],
        [await book(body, first.id, 'bad'), 400, 'INVALID_SERVICE_ID'],
        [await book(body, first.id, service.id, 'bad'), 400, 'INVALID_BUSINESS_ID'],
        [await book(body, first.id, service.id, randomUUID()), 404, 'BUSINESS_NOT_FOUND'],
        [await book(body, first.id, foreign.id), 404, 'SERVICE_NOT_FOUND'],
        [await book(body, first.id, inactive.id), 404, 'SERVICE_NOT_FOUND'],
        [await book(body, unassigned.id), 404, 'SPECIALIST_NOT_FOUND'],
        [await book(body, disabled.id), 404, 'SPECIALIST_NOT_FOUND'],
        [await book(body, foreignSpecialist.id), 404, 'SPECIALIST_NOT_FOUND'],
        [await book({ ...body, startsAt: `${date}T08:01:00Z` }), 409, 'SLOT_UNAVAILABLE'],
        [await book({ ...body, startsAt: `${date}T07:45:00Z` }), 409, 'SLOT_UNAVAILABLE'],
        [await book({ ...body, startsAt: `${date}T10:45:00Z` }), 409, 'SLOT_UNAVAILABLE'],
        [await book({ ...body, date: '2099-01-05' }), 409, 'SLOT_UNAVAILABLE'],
        [
          await book({ ...body, date: '2000-01-04', startsAt: '2000-01-04T08:00:00Z' }),
          409,
          'SLOT_UNAVAILABLE',
        ],
      ]) {
        assert.equal(response.status, status);
        assert.equal((await response.json()).error.code, code);
      }
      assert.equal(await prisma.booking.count(), 0);

      const created = await book({ ...body, endsAt: `${date}T08:01:00Z` });
      assert.equal(created.status, 201);
      const { booking } = await created.json();
      assert.deepEqual(booking, {
        id: booking.id,
        businessId: business.id,
        serviceId: service.id,
        specialistId: first.id,
        startsAt: `${date}T08:00:00.000Z`,
        endsAt: `${date}T08:30:00.000Z`,
      });
      const persisted = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(persisted.cancelledAt, null);
      assert.equal(persisted.customerName, 'Example Customer');
      assert.equal(persisted.customerPhone, '+12025550123');
      assert.equal(persisted.endsAt.toISOString(), booking.endsAt);
      await expectError(
        await book({ ...body, startsAt: `${date}T08:15:00Z` }),
        409,
        'BOOKING_CONFLICT',
        'The selected time overlaps an existing booking.',
      );
      assert.equal((await book({ ...body, startsAt: `${date}T08:30:00Z` })).status, 201);
      await prisma.booking.update({ where: { id: booking.id }, data: { cancelledAt: new Date() } });
      assert.equal((await book(body)).status, 201);

      const competing = await Promise.all([
        book({ ...body, startsAt: `${date}T09:00:00Z` }),
        book({ ...body, startsAt: `${date}T09:15:00Z` }),
      ]);
      const [winner, conflict] = competing[0].status === 201 ? competing : competing.reverse();
      assert.equal(winner.status, 201);
      await winner.json();
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).error.code, 'BOOKING_CONFLICT');
      assert.equal(
        await prisma.booking.count({
          where: { specialistId: first.id, startsAt: { gte: new Date(`${date}T09:00:00Z`) } },
        }),
        1,
      );

      const foldDate = '2099-10-25';
      await prisma.specialistWorkingPeriod.create({
        data: {
          businessId: business.id,
          specialistId: first.id,
          weekday: 7,
          startMinute: 60,
          endMinute: 240,
        },
      });
      for (const hour of ['00', '01']) {
        const utcStart = `${foldDate}T${hour}:30:00`;
        const response = await book({ ...body, date: foldDate, startsAt: `${utcStart}.000Z` });
        assert.equal(response.status, 201);
        assert.equal((await response.json()).booking.startsAt, `${utcStart}.000Z`);
      }
    });

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
