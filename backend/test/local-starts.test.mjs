import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLocalStartMinutes } from '../src/availability/local-starts.ts';

test('local candidates fit the full duration, respect breaks and include exact closing boundaries', () => {
  const periods = [
    { startMinute: 840, endMinute: 900 },
    { startMinute: 540, endMinute: 600 },
  ];
  assert.deepEqual(generateLocalStartMinutes(periods, 30), [540, 555, 570, 840, 855, 870]);
  assert.deepEqual(
    periods.map((p) => p.startMinute),
    [840, 540],
  );
  assert.deepEqual(generateLocalStartMinutes(periods, 60), [540, 840]);
  assert.deepEqual(generateLocalStartMinutes(periods, 61), []);
  assert.deepEqual(generateLocalStartMinutes([], 30), []);
});

test('start grids are anchored to each period and independent from service duration', () => {
  assert.deepEqual(
    generateLocalStartMinutes([{ startMinute: 547, endMinute: 610 }], 20, 15),
    [547, 562, 577],
  );
  assert.deepEqual(
    generateLocalStartMinutes([{ startMinute: 1380, endMinute: 1440 }], 30, 30),
    [1380, 1410],
  );
  assert.deepEqual(
    generateLocalStartMinutes(
      [
        { startMinute: 540, endMinute: 555 },
        { startMinute: 555, endMinute: 570 },
      ],
      30,
    ),
    [],
  );
});

test('invalid durations, steps and intervals fail instead of generating misleading candidates', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => generateLocalStartMinutes([], value), RangeError);
    assert.throws(() => generateLocalStartMinutes([], 30, value), RangeError);
  }
  for (const periods of [
    [{ startMinute: -1, endMinute: 30 }],
    [{ startMinute: 0, endMinute: 1441 }],
    [{ startMinute: 30, endMinute: 30 }],
    [{ startMinute: 60, endMinute: 30 }],
    [{ startMinute: 0.5, endMinute: 30 }],
    [{ startMinute: 0, endMinute: NaN }],
    [
      { startMinute: 0, endMinute: 60 },
      { startMinute: 30, endMinute: 90 },
    ],
  ])
    assert.throws(() => generateLocalStartMinutes(periods, 30), RangeError);
});
