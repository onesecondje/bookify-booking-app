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
  const managedBusinessId = randomUUID();
  const token = randomUUID().replaceAll('-', '');
  const server = createApp(prisma, { businessId: managedBusinessId, token }).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    for (const migration of [
      '0_init',
      '20261110000100_add_specialists_and_service_assignments',
      '20261112000100_add_specialist_working_periods',
      '20261118000100_add_bookings',
      '20261119000100_add_booking_customer_contact',
      '20261126000100_add_booking_approval',
    ]) {
      await pool.query(
        await readFile(
          new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
          'utf8',
        ),
      );
    }
    const business = await prisma.business.create({
      data: { id: managedBusinessId, name: 'Studio', timeZone: 'Europe/Warsaw' },
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
      'managed catalogue includes inactive services and all assignments for its business',
      async () => {
        const url = (id) => `${origin}/api/businesses/${id}/manage/services`;
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal((await globalThis.fetch(url(business.id))).status, 401);
        assert.equal((await globalThis.fetch(url(other.id), { headers })).status, 403);

        const response = await globalThis.fetch(url(business.id), { headers });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const { services } = await response.json();
        assert.deepEqual(
          services.map(({ id }) => id),
          [service.id, inactive.id, inactiveOnly.id, empty.id],
        );
        assert.deepEqual(services[0], {
          id: service.id,
          name: service.name,
          durationMinutes: 30,
          isActive: true,
          specialists: [disabled, alex, first, second].map((specialist) => ({
            isActive: true,
            ...specialist,
          })),
        });
        assert.equal(services[1].isActive, false);
        assert.deepEqual(
          services[1].specialists,
          [unassigned, first].map((specialist) => ({
            isActive: true,
            ...specialist,
          })),
        );
        assert.deepEqual(services[3].specialists, []);
      },
    );

    await t.test(
      'weekly schedule requires business access and returns sorted working periods',
      async () => {
        const scheduleUrl = (id) => `${origin}/api/businesses/${id}/schedule`;
        const headers = { Authorization: `Bearer ${token}` };
        const unauthorized = await globalThis.fetch(scheduleUrl(business.id));
        assert.equal(unauthorized.status, 401);
        assert.equal(unauthorized.headers.get('www-authenticate'), 'Bearer');
        assert.equal((await globalThis.fetch(scheduleUrl(other.id), { headers })).status, 403);

        const workingPeriods = [
          { weekday: 1, startMinute: 540, endMinute: 780 },
          { weekday: 1, startMinute: 840, endMinute: 1080 },
          { weekday: 7, startMinute: 1380, endMinute: 1440 },
        ];
        await prisma.specialistWorkingPeriod.createMany({
          data: [...workingPeriods].reverse().map((period) => ({
            ...period,
            businessId: business.id,
            specialistId: unassigned.id,
          })),
        });
        const response = await globalThis.fetch(scheduleUrl(business.id), { headers });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const specialists = [unassigned, alex, first, second, disabled].map((specialist) => ({
          isActive: true,
          ...specialist,
        }));
        assert.deepEqual(await response.json(), {
          specialists,
          schedule: { ...unassigned, timeZone: 'Europe/Warsaw', workingPeriods },
        });

        const select = (id) =>
          globalThis.fetch(`${scheduleUrl(business.id)}?specialistId=${id}`, { headers });
        const selected = await select(disabled.id.toUpperCase());
        assert.equal(selected.status, 200);
        assert.deepEqual(await selected.json(), {
          specialists,
          schedule: {
            id: disabled.id,
            name: disabled.name,
            timeZone: 'Europe/Warsaw',
            workingPeriods: [],
          },
        });
        const foreignSchedule = await select(foreignSpecialist.id);
        assert.equal(foreignSchedule.status, 200);
        assert.deepEqual(await foreignSchedule.json(), { specialists, schedule: null });
        for (const invalidId of ['invalid', `${alex.id}&specialistId=${first.id}`]) {
          await expectError(
            await select(invalidId),
            400,
            'INVALID_SPECIALIST_ID',
            'specialistId must be a valid UUID.',
          );
        }

        const editUrl = `${scheduleUrl(business.id)}/${unassigned.id}`;
        const replace = (day, periods, access = headers, url = editUrl) =>
          globalThis.fetch(`${url}/${day}`, {
            method: 'PUT',
            headers: { ...access, 'Content-Type': 'application/json' },
            body: JSON.stringify({ periods }),
          });
        const replacement = [
          { startMinute: 600, endMinute: 720 },
          { startMinute: 720, endMinute: 780 },
        ];
        assert.equal((await replace(1, replacement, {})).status, 401);
        assert.equal(
          (
            await replace(
              1,
              replacement,
              headers,
              `${scheduleUrl(other.id)}/${foreignSpecialist.id}`,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await replace(
              1,
              replacement,
              headers,
              `${scheduleUrl(business.id)}/${foreignSpecialist.id}`,
            )
          ).status,
          404,
        );
        assert.equal((await replace(8, replacement)).status, 400);
        assert.equal(
          (await replace(1, [replacement[0], { startMinute: 719, endMinute: 780 }])).status,
          400,
        );
        assert.deepEqual(
          (await (await select(unassigned.id)).json()).schedule.workingPeriods,
          workingPeriods,
        );
        assert.equal((await replace(1, replacement)).status, 204);
        assert.deepEqual((await (await select(unassigned.id)).json()).schedule.workingPeriods, [
          ...replacement.map((period) => ({ weekday: 1, ...period })),
          workingPeriods[2],
        ]);
        assert.equal((await replace(1, [])).status, 204);
        assert.deepEqual((await (await select(unassigned.id)).json()).schedule.workingPeriods, [
          workingPeriods[2],
        ]);

        const competing = [{ startMinute: 900, endMinute: 960 }];
        const saves = await Promise.all([replace(6, replacement), replace(6, competing)]);
        assert(saves.every(({ status }) => status === 204 || status === 409));
        assert(saves.some(({ status }) => status === 204));
        const updated = (await (await select(unassigned.id)).json()).schedule.workingPeriods;
        const saturday = updated.filter(({ weekday }) => weekday === 6);
        const written = saturday.length === replacement.length ? replacement : competing;
        assert.deepEqual(
          saturday,
          written.map((period) => ({ weekday: 6, ...period })),
        );
      },
    );

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

    await t.test(
      'business bookings require credentials and scope contacts to the managed business',
      async () => {
        const list = (id, authorization) =>
          globalThis.fetch(`${origin}/api/businesses/${id}/bookings`, {
            headers: authorization ? { Authorization: authorization } : {},
          });
        for (const authorization of [undefined, `Bearer ${'x'.repeat(32)}`]) {
          const response = await list(business.id, authorization);
          assert.equal(response.headers.get('www-authenticate'), 'Bearer');
          await expectError(response, 401, 'UNAUTHORIZED', 'Business credentials are required.');
        }
        for (const id of [other.id, randomUUID()]) {
          await expectError(
            await list(id, `Bearer ${token}`),
            403,
            'FORBIDDEN',
            'Access to this business is forbidden.',
          );
        }

        const add = (businessId, serviceId, specialistId, day, extra = {}) =>
          prisma.booking.create({
            data: {
              businessId,
              serviceId,
              specialistId,
              startsAt: new Date(`${day}T08:00:00Z`),
              endsAt: new Date(`${day}T08:30:00Z`),
              ...extra,
            },
          });
        const cancelled = await add(business.id, service.id, first.id, '2099-01-09', {
          approvedAt: new Date('2098-12-31T00:00:00Z'),
          cancelledAt: new Date('2099-01-01T00:00:00Z'),
        });
        const upcoming = await add(business.id, service.id, first.id, '2099-01-08', {
          customerName: 'Example Customer',
          customerPhone: '+12025550123',
        });
        const past = await add(business.id, service.id, first.id, '2000-01-01');
        const crossBusiness = await add(other.id, foreign.id, foreignSpecialist.id, '2099-01-08', {
          customerName: 'Other Customer',
          customerPhone: '+12025550124',
        });
        try {
          const response = await list(business.id.toUpperCase(), `Bearer ${token}`);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.deepEqual(await response.json(), {
            bookings: [upcoming, cancelled].map((booking) => ({
              id: booking.id,
              startsAt: booking.startsAt.toISOString(),
              endsAt: booking.endsAt.toISOString(),
              approvedAt: booking.approvedAt?.toISOString() ?? null,
              cancelledAt: booking.cancelledAt?.toISOString() ?? null,
              customerName: booking.customerName,
              customerPhone: booking.customerPhone,
              service: { id: service.id, name: 'Haircut' },
              specialist: { id: first.id, name: first.name },
            })),
          });
        } finally {
          await prisma.booking.deleteMany({
            where: { id: { in: [upcoming.id, cancelled.id, past.id, crossBusiness.id] } },
          });
        }
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
        [await book({ ...body, customerName: '12345' }), 400, 'INVALID_CUSTOMER_NAME'],
        [await book({ ...body, customerName: 'Олена2' }), 400, 'INVALID_CUSTOMER_NAME'],
        [await book({ ...body, customerName: '--' }), 400, 'INVALID_CUSTOMER_NAME'],
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
      assert.equal(persisted.approvedAt, null);
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
      const adjacentResponse = await book({ ...body, startsAt: `${date}T08:30:00Z` });
      assert.equal(adjacentResponse.status, 201);
      const { booking: adjacent } = await adjacentResponse.json();
      const isSlotAvailable = async () => {
        const response = await request(
          business.id,
          service.id,
          `/${first.id}/availability?date=${date}`,
        );
        assert.equal(response.status, 200);
        return (await response.json()).slots.some((slot) => slot.startsAt === startsAt);
      };
      const changeBooking = (
        action,
        id,
        authorization = `Bearer ${token}`,
        targetBusiness = business.id,
      ) =>
        globalThis.fetch(`${origin}/api/businesses/${targetBusiness}/bookings/${id}/${action}`, {
          method: 'PATCH',
          headers: authorization ? { Authorization: authorization } : {},
        });
      assert.equal(await isSlotAvailable(), false);
      const foreignBooking = await prisma.booking.create({
        data: {
          businessId: other.id,
          serviceId: foreign.id,
          specialistId: foreignSpecialist.id,
          startsAt: new Date(startsAt),
          endsAt: new Date(booking.endsAt),
        },
      });
      const pastBooking = await prisma.booking.create({
        data: {
          businessId: business.id,
          serviceId: service.id,
          specialistId: first.id,
          startsAt: new Date('2000-01-04T08:00:00Z'),
          endsAt: new Date('2000-01-04T08:30:00Z'),
        },
      });
      for (const action of ['approve', 'reject', 'cancel']) {
        assert.equal((await changeBooking(action, booking.id, null)).status, 401);
        assert.equal(
          (await changeBooking(action, booking.id, `Bearer ${token}`, other.id)).status,
          403,
        );
        assert.equal((await changeBooking(action, 'invalid')).status, 400);
        assert.equal((await changeBooking(action, foreignBooking.id)).status, 404);
        assert.equal((await changeBooking(action, pastBooking.id)).status, 404);
      }
      assert.equal(
        (await prisma.booking.findUniqueOrThrow({ where: { id: foreignBooking.id } })).cancelledAt,
        null,
      );
      assert.equal(await isSlotAvailable(), false);
      assert.equal((await changeBooking('cancel', booking.id)).status, 409);
      assert.equal((await changeBooking('approve', booking.id)).status, 204);
      const approved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.ok(approved.approvedAt);
      assert.equal(approved.cancelledAt, null);
      assert.equal(await isSlotAvailable(), false);
      await expectError(
        await changeBooking('reject', booking.id),
        409,
        'BOOKING_STATE_CONFLICT',
        'This action is unavailable for the current booking status.',
      );
      assert.equal((await changeBooking('cancel', booking.id)).status, 204);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.ok(after.cancelledAt);
      assert.deepEqual(after.approvedAt, approved.approvedAt);
      assert.equal((await changeBooking('cancel', booking.id)).status, 204);
      assert.deepEqual(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).cancelledAt,
        after.cancelledAt,
      );
      assert.equal(await isSlotAvailable(), true);
      const rebooked = await book(body);
      assert.equal(rebooked.status, 201);
      const { booking: pending } = await rebooked.json();
      assert.equal(await isSlotAvailable(), false);
      assert.equal((await changeBooking('reject', pending.id)).status, 204);
      const rejected = await prisma.booking.findUniqueOrThrow({ where: { id: pending.id } });
      assert.equal(rejected.approvedAt, null);
      assert.ok(rejected.cancelledAt);
      assert.equal((await changeBooking('approve', pending.id)).status, 409);
      assert.equal(await isSlotAvailable(), true);
      assert.equal((await book(body)).status, 201);

      const [approval, rejection] = await Promise.all([
        changeBooking('approve', adjacent.id),
        changeBooking('reject', adjacent.id),
      ]);
      assert.deepEqual([approval.status, rejection.status].sort(), [204, 409]);
      const reviewed = await prisma.booking.findUniqueOrThrow({ where: { id: adjacent.id } });
      assert.equal(Boolean(reviewed.approvedAt), approval.status === 204);
      assert.equal(Boolean(reviewed.cancelledAt), rejection.status === 204);

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
      'service edits change future booking duration and preserve existing bookings',
      async () => {
        const editable = await makeService(business.id, 'Consultation');
        await prisma.specialistService.create({
          data: { businessId: business.id, serviceId: editable.id, specialistId: first.id },
        });
        const date = '2099-01-13';
        const servicePath = `${origin}/api/businesses/${business.id}/services/${editable.id}/specialists/${first.id}`;
        const jsonHeaders = { 'Content-Type': 'application/json' };
        const headers = { ...jsonHeaders, Authorization: `Bearer ${token}` };
        const update = { name: '  Extended consultation  ', durationMinutes: 45, isActive: true };
        const edit = (
          data = update,
          credentials = headers,
          id = editable.id,
          target = business.id,
        ) =>
          globalThis.fetch(`${origin}/api/businesses/${target}/manage/services/${id}`, {
            method: 'PUT',
            headers: credentials,
            body: JSON.stringify(data),
          });
        const book = (time) =>
          globalThis.fetch(`${servicePath}/bookings`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              date,
              startsAt: `${date}T${time}:00Z`,
              customerName: 'Example Customer',
              customerPhone: '+12025550123',
            }),
          });

        const firstResponse = await book('08:00');
        assert.equal(firstResponse.status, 201);
        const { booking: original } = await firstResponse.json();
        assert.equal(original.endsAt, `${date}T08:30:00.000Z`);
        const storedOriginal = await prisma.booking.findUniqueOrThrow({
          where: { id: original.id },
        });
        assert.equal((await edit(update, jsonHeaders)).status, 401);
        assert.equal((await edit(update, headers, foreign.id, other.id)).status, 403);
        assert.equal((await edit(update, headers, foreign.id)).status, 404);
        assert.equal((await edit(update, headers, 'invalid')).status, 400);
        for (const input of [
          { ...update, name: '  ' },
          { ...update, durationMinutes: 0 },
          { ...update, durationMinutes: 1.5 },
          { ...update, durationMinutes: 2_147_483_648 },
          { ...update, isActive: 'false' },
        ]) {
          assert.equal((await edit(input)).status, 400);
        }
        assert.deepEqual(
          await prisma.service.findUniqueOrThrow({ where: { id: editable.id } }),
          editable,
        );
        assert.equal((await edit()).status, 204);

        const availability = await globalThis.fetch(`${servicePath}/availability?date=${date}`);
        assert.equal(availability.status, 200);
        const { slots } = await availability.json();
        assert(
          slots.some(
            (slot) => slot.startsAt === `${date}T08:30:00Z` && slot.endsAt === `${date}T09:15:00Z`,
          ),
        );
        assert(!slots.some((slot) => slot.startsAt === `${date}T10:30:00Z`));

        const nextResponse = await book('08:30');
        assert.equal(nextResponse.status, 201);
        const { booking: next } = await nextResponse.json();
        assert.equal(next.endsAt, `${date}T09:15:00.000Z`);
        const catalogue = `${origin}/api/businesses/${business.id}/services`;
        const readPublicService = async () =>
          (await (await globalThis.fetch(catalogue)).json()).services.find(
            ({ id }) => id === editable.id,
          );
        assert.deepEqual(await readPublicService(), {
          id: editable.id,
          name: 'Extended consultation',
          durationMinutes: 45,
        });
        assert.equal((await edit({ ...update, isActive: false })).status, 204);
        assert.equal(await readPublicService(), undefined);
        assert.equal((await book('09:15')).status, 404);

        assert.deepEqual(
          await prisma.booking.findUniqueOrThrow({ where: { id: original.id } }),
          storedOriginal,
        );
        assert.equal(
          (await prisma.booking.findUniqueOrThrow({ where: { id: next.id } })).endsAt.toISOString(),
          next.endsAt,
        );
      },
    );
    await t.test(
      'businesses can create a service that guests can book with assigned specialists',
      async () => {
        const jsonHeaders = { 'Content-Type': 'application/json' };
        const headers = { ...jsonHeaders, Authorization: `Bearer ${token}` };
        const newService = {
          name: '  Styling consultation  ',
          durationMinutes: 45,
          specialistIds: [second.id.toUpperCase(), first.id],
        };
        const create = (data = newService, credentials = headers, target = business.id) =>
          globalThis.fetch(`${origin}/api/businesses/${target}/manage/services`, {
            method: 'POST',
            headers: credentials,
            body: JSON.stringify(data),
          });
        const before = await prisma.service.count();
        assert.equal((await create(newService, jsonHeaders)).status, 401);
        assert.equal((await create(newService, headers, other.id)).status, 403);
        for (const data of [
          { ...newService, name: ' ' },
          { ...newService, durationMinutes: -1 },
          { ...newService, specialistIds: [] },
          { ...newService, specialistIds: ['invalid'] },
          { ...newService, specialistIds: [first.id, first.id.toUpperCase()] },
        ]) {
          assert.equal((await create(data)).status, 400);
        }
        for (const unavailable of [disabled.id, foreignSpecialist.id, randomUUID()]) {
          assert.equal(
            (await create({ ...newService, specialistIds: [first.id, unavailable] })).status,
            404,
          );
        }
        assert.equal(await prisma.service.count(), before);

        const created = await create();
        assert.equal(created.status, 201);
        const {
          service: { id },
        } = await created.json();
        const publicServices = await globalThis.fetch(
          `${origin}/api/businesses/${business.id}/services`,
        );
        assert.equal(publicServices.status, 200);
        assert.deepEqual(
          (await publicServices.json()).services.find((item) => item.id === id),
          {
            id,
            name: 'Styling consultation',
            durationMinutes: 45,
          },
        );
        const assigned = await request(business.id, id);
        assert.equal(assigned.status, 200);
        assert.deepEqual(await assigned.json(), { specialists: [first, second] });

        await prisma.specialistWorkingPeriod.create({
          data: {
            businessId: business.id,
            specialistId: second.id,
            weekday: 4,
            startMinute: 540,
            endMinute: 660,
          },
        });
        const date = '2099-01-08';
        const availability = await request(
          business.id,
          id,
          `/${second.id}/availability?date=${date}`,
        );
        assert.equal(availability.status, 200);
        const { slots } = await availability.json();
        assert.deepEqual(slots[0], { startsAt: `${date}T08:00:00Z`, endsAt: `${date}T08:45:00Z` });

        const book = (specialistId) =>
          globalThis.fetch(
            `${origin}/api/businesses/${business.id}/services/${id}/specialists/${specialistId}/bookings`,
            {
              method: 'POST',
              headers: jsonHeaders,
              body: JSON.stringify({
                date,
                startsAt: slots[0].startsAt,
                customerName: 'Example Guest',
                customerPhone: '+12025550123',
              }),
            },
          );
        assert.equal((await book(unassigned.id)).status, 404);
        const booked = await book(second.id);
        assert.equal(booked.status, 201);
        const { booking } = await booked.json();
        assert.equal(booking.serviceId, id);
        assert.equal(booking.specialistId, second.id);
        assert.equal(booking.endsAt, `${date}T08:45:00.000Z`);
      },
    );

    await t.test('service assignments can be replaced without changing bookings', async () => {
      const editable = await makeService(business.id, 'Assignment edit');
      const assignmentKey = { businessId: business.id, serviceId: editable.id };
      await prisma.specialistService.createMany({
        data: [first.id, disabled.id].map((specialistId) => ({ ...assignmentKey, specialistId })),
      });
      const assignmentIds = async () =>
        (await prisma.specialistService.findMany({ where: assignmentKey }))
          .map(({ specialistId }) => specialistId)
          .sort();
      const update = { name: 'Updated assignments', durationMinutes: 45, isActive: true };
      const edit = (data) =>
        globalThis.fetch(`${origin}/api/businesses/${business.id}/manage/services/${editable.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      const book = (specialistId, date) =>
        globalThis.fetch(
          `${origin}/api/businesses/${business.id}/services/${editable.id}/specialists/${specialistId}/bookings`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date,
              startsAt: `${date}T08:00:00Z`,
              customerName: 'Example Guest',
              customerPhone: '+12025550123',
            }),
          },
        );

      const booked = await book(first.id, '2099-01-20');
      assert.equal(booked.status, 201);
      const { booking } = await booked.json();
      const bookingWhere = { id: booking.id };
      const originalBooking = await prisma.booking.findUniqueOrThrow({ where: bookingWhere });

      for (const specialistIds of [null, ['invalid'], [disabled.id, disabled.id.toUpperCase()]]) {
        assert.equal((await edit({ ...update, specialistIds })).status, 400);
      }
      for (const id of [alex.id, foreignSpecialist.id, randomUUID()]) {
        await expectError(
          await edit({ ...update, specialistIds: [second.id, id] }),
          404,
          'SPECIALIST_NOT_FOUND',
          'One or more selected specialists are unavailable.',
        );
      }
      assert.deepEqual(await assignmentIds(), [first.id, disabled.id].sort());
      assert.deepEqual(
        await prisma.service.findUniqueOrThrow({ where: { id: editable.id } }),
        editable,
      );

      assert.equal(
        (await edit({ ...update, specialistIds: [second.id, disabled.id] })).status,
        204,
      );
      assert.deepEqual(await assignmentIds(), [second.id, disabled.id].sort());
      assert.deepEqual(await (await request(business.id, editable.id)).json(), {
        specialists: [second],
      });
      assert.equal((await book(first.id, '2099-01-27')).status, 404);
      assert.equal((await book(second.id, '2099-01-15')).status, 201);

      assert.equal((await edit({ ...update, specialistIds: [] })).status, 204);
      assert.deepEqual(await assignmentIds(), []);
      assert.deepEqual(await (await request(business.id, editable.id)).json(), {
        specialists: [],
      });
      assert.deepEqual(
        await prisma.booking.findUniqueOrThrow({ where: bookingWhere }),
        originalBooking,
      );

      const concurrent = await Promise.all([
        edit({ ...update, name: 'First assignment', specialistIds: [first.id] }),
        edit({ ...update, name: 'Second assignment', specialistIds: [second.id] }),
      ]);
      assert.deepEqual(
        concurrent.map(({ status }) => status),
        [204, 204],
      );
      const saved = await prisma.service.findUniqueOrThrow({ where: { id: editable.id } });
      assert.deepEqual(await assignmentIds(), [
        saved.name === 'First assignment' ? first.id : second.id,
      ]);
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
