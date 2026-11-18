import assert from 'node:assert/strict';
import test from 'node:test';
import { generateScheduleSlots } from '../src/availability/schedule-slots.ts';
import { demoWorkingPeriods } from '../src/demo-data.ts';

const calculate = (overrides = {}) =>
  generateScheduleSlots({
    date: '2026-11-16',
    timeZone: 'Europe/Warsaw',
    durationMinutes: 30,
    periods: [{ weekday: 1, startMinute: 540, endMinute: 600 }],
    now: '2026-01-01T00:00:00Z',
    ...overrides,
  });

test('weekly periods become sorted future UTC slots with a full elapsed duration', () => {
  assert.deepEqual(calculate(), {
    unresolvedPeriodCount: 0,
    slots: [
      { startsAt: '2026-11-16T08:00:00Z', endsAt: '2026-11-16T08:30:00Z' },
      { startsAt: '2026-11-16T08:15:00Z', endsAt: '2026-11-16T08:45:00Z' },
      { startsAt: '2026-11-16T08:30:00Z', endsAt: '2026-11-16T09:00:00Z' },
    ],
  });
  assert.equal(calculate({ now: '2026-11-16T08:15:00Z' }).slots.length, 1);
  assert.deepEqual(calculate({ now: '2026-11-16T10:00:00Z' }).slots, []);
  assert.deepEqual(calculate({ date: '2026-11-17' }).slots, []);
  assert.deepEqual(calculate({ durationMinutes: 61 }).slots, []);
});

test('the seeded Alice schedule preserves lunch and weekends without mutating input', () => {
  const periods = demoWorkingPeriods.filter((p) => p.specialistId.endsWith('0001'));
  const before = globalThis.structuredClone(periods);
  const result = calculate({ periods });
  assert.equal(result.slots.length, 30);
  assert.ok(
    !result.slots.some(
      (s) => s.startsAt >= '2026-11-16T12:00:00Z' && s.startsAt < '2026-11-16T13:00:00Z',
    ),
  );
  assert.deepEqual(calculate({ periods, date: '2026-11-21' }).slots, []);
  assert.deepEqual(periods, before);
});

test('spring gaps skip nonexistent starts and elapsed duration cannot exceed closing', () => {
  const result = calculate({
    date: '2026-03-29',
    periods: [{ weekday: 7, startMinute: 60, endMinute: 240 }],
    durationMinutes: 90,
    stepMinutes: 30,
  });
  assert.deepEqual(result, {
    unresolvedPeriodCount: 0,
    slots: [
      { startsAt: '2026-03-29T00:00:00Z', endsAt: '2026-03-29T01:30:00Z' },
      { startsAt: '2026-03-29T00:30:00Z', endsAt: '2026-03-29T02:00:00Z' },
    ],
  });
});

test('autumn folds offer both instants, including long durations fitting only in elapsed time', () => {
  const periods = [{ weekday: 7, startMinute: 60, endMinute: 240 }];
  const result = calculate({ date: '2026-10-25', periods, durationMinutes: 30, stepMinutes: 30 });
  assert.equal(result.slots.length, 8);
  assert.ok(result.slots.some((s) => s.startsAt === '2026-10-25T00:30:00Z'));
  assert.ok(result.slots.some((s) => s.startsAt === '2026-10-25T01:30:00Z'));
  assert.deepEqual(
    result.slots.map((s) => s.startsAt),
    [...result.slots.map((s) => s.startsAt)].sort(),
  );
  assert.equal(
    calculate({ date: '2026-10-25', periods, durationMinutes: 210, stepMinutes: 30 }).slots.length,
    2,
  );
  for (const slot of result.slots)
    assert.equal(Date.parse(slot.endsAt) - Date.parse(slot.startsAt), 30 * 60000);
});

test('uncertain working boundaries are skipped explicitly while other periods remain usable', () => {
  for (const date of ['2026-03-29', '2026-10-25']) {
    const result = calculate({
      date,
      periods: [
        { weekday: 7, startMinute: 150, endMinute: 240 },
        { weekday: 7, startMinute: 540, endMinute: 600 },
      ],
    });
    assert.equal(result.unresolvedPeriodCount, 1);
    assert.equal(result.slots.length, 3);
  }
});

test('next midnight and separate adjacent periods retain their boundaries', () => {
  assert.equal(
    calculate({ periods: [{ weekday: 1, startMinute: 1410, endMinute: 1440 }] }).slots[0].endsAt,
    '2026-11-16T23:00:00Z',
  );
  assert.deepEqual(
    calculate({
      periods: [
        { weekday: 1, startMinute: 540, endMinute: 555 },
        { weekday: 1, startMinute: 555, endMinute: 570 },
      ],
    }).slots,
    [],
  );
});

test('invalid inputs fail even for empty schedules', () => {
  for (const overrides of [
    { date: '2026-02-30' },
    { timeZone: 'bad' },
    { now: '2026-01-01' },
    { durationMinutes: 0 },
    { stepMinutes: 0 },
  ]) {
    assert.throws(() => calculate({ periods: [], ...overrides }), RangeError);
  }
  assert.throws(
    () => calculate({ periods: [{ weekday: 8, startMinute: 540, endMinute: 600 }] }),
    RangeError,
  );
  assert.throws(
    () =>
      calculate({
        periods: [
          { weekday: 2, startMinute: 540, endMinute: 600 },
          { weekday: 2, startMinute: 550, endMinute: 650 },
        ],
      }),
    RangeError,
  );
});
