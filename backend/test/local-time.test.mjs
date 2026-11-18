import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocalTime } from '../src/availability/local-time.ts';
import { isTimeZone } from '../src/validation/time-zone.ts';

test('local time resolves using the business zone and seasonal offset', () => {
  assert.deepEqual(resolveLocalTime('2026-01-15', 540, 'Europe/Warsaw'), {
    status: 'unique',
    utc: '2026-01-15T08:00:00Z',
  });
  assert.deepEqual(resolveLocalTime('2026-07-15', 540, 'Europe/Warsaw'), {
    status: 'unique',
    utc: '2026-07-15T07:00:00Z',
  });
  assert.deepEqual(resolveLocalTime('2026-01-15', 540, 'Asia/Kathmandu'), {
    status: 'unique',
    utc: '2026-01-15T03:15:00Z',
  });
  assert.deepEqual(resolveLocalTime('2026-01-15', 0, 'UTC'), {
    status: 'unique',
    utc: '2026-01-15T00:00:00Z',
  });
});

test('spring gaps are reported without moving the selected local time', () => {
  assert.deepEqual(resolveLocalTime('2026-03-29', 150, 'Europe/Warsaw'), { status: 'nonexistent' });
  assert.deepEqual(resolveLocalTime('2026-03-29', 119, 'Europe/Warsaw'), {
    status: 'unique',
    utc: '2026-03-29T00:59:00Z',
  });
  assert.deepEqual(resolveLocalTime('2026-03-29', 180, 'Europe/Warsaw'), {
    status: 'unique',
    utc: '2026-03-29T01:00:00Z',
  });
});

test('autumn folds return both UTC instants in chronological order', () => {
  assert.deepEqual(resolveLocalTime('2026-10-25', 150, 'Europe/Warsaw'), {
    status: 'ambiguous',
    earlierUtc: '2026-10-25T00:30:00Z',
    laterUtc: '2026-10-25T01:30:00Z',
  });
  assert.deepEqual(resolveLocalTime('2026-10-25', 180, 'Europe/Warsaw'), {
    status: 'unique',
    utc: '2026-10-25T02:00:00Z',
  });
});

test('offset changes need not be one hour and can skip a whole local date', () => {
  assert.deepEqual(resolveLocalTime('2026-10-04', 135, 'Australia/Lord_Howe'), {
    status: 'nonexistent',
  });
  assert.deepEqual(resolveLocalTime('2026-04-05', 105, 'Australia/Lord_Howe'), {
    status: 'ambiguous',
    earlierUtc: '2026-04-04T14:45:00Z',
    laterUtc: '2026-04-04T15:15:00Z',
  });
  assert.deepEqual(resolveLocalTime('2011-12-30', 540, 'Pacific/Apia'), { status: 'nonexistent' });
});

test('minute 1440 means next local midnight, including short and long DST days', () => {
  for (const [date, expected, hours] of [
    ['2026-03-29', '2026-03-29T22:00:00Z', 23],
    ['2026-10-25', '2026-10-25T23:00:00Z', 25],
  ]) {
    const start = resolveLocalTime(date, 0, 'Europe/Warsaw');
    const end = resolveLocalTime(date, 1440, 'Europe/Warsaw');
    assert.equal(end.utc, expected);
    assert.equal((Date.parse(end.utc) - Date.parse(start.utc)) / 3600000, hours);
  }
  assert.equal(resolveLocalTime('2026-12-31', 1440, 'UTC').utc, '2027-01-01T00:00:00Z');
  assert.equal(resolveLocalTime('2028-02-29', 1440, 'UTC').utc, '2028-03-01T00:00:00Z');
});

test('invalid calendar dates, minute values and time zones are rejected', () => {
  for (const date of [
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-1-01',
    '2026-01-01T09:00',
    '0000-01-01',
    '',
  ]) {
    assert.throws(() => resolveLocalTime(date, 540, 'Europe/Warsaw'), RangeError);
  }
  for (const minute of [-1, 1441, 0.5, NaN, Infinity]) {
    assert.throws(() => resolveLocalTime('2026-01-01', minute, 'Europe/Warsaw'), RangeError);
  }
  for (const zone of ['', ' ', ' Europe/Warsaw', 'Invalid/Zone', '+01:00', '-05:00']) {
    assert.equal(isTimeZone(zone), false);
    assert.throws(() => resolveLocalTime('2026-01-01', 540, zone), RangeError);
  }
  assert.equal(isTimeZone(undefined), false);
  assert.equal(isTimeZone('UTC'), true);
  assert.equal(isTimeZone('Europe/Warsaw'), true);
});
