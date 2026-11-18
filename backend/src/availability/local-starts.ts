import type { WorkingPeriodMinutes } from './types/schedule-slots.types.js';

// Generate local wall-clock candidates for one day, before timezone/DST resolution.
// Adjacent periods remain separate; each candidate must fit inside one period.
export function generateLocalStartMinutes(
  periods: readonly WorkingPeriodMinutes[],
  durationMinutes: number,
  stepMinutes = 15,
): number[] {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError('Service duration must be a positive integer.');
  }
  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError('Start step must be a positive integer.');
  }

  const ordered = [...periods].sort((a, b) => a.startMinute - b.startMinute);
  let previousEnd = 0;
  for (const period of ordered) {
    if (
      !Number.isInteger(period.startMinute) ||
      !Number.isInteger(period.endMinute) ||
      period.startMinute < 0 ||
      period.endMinute > 1440 ||
      period.startMinute >= period.endMinute ||
      period.startMinute < previousEnd
    ) {
      throw new RangeError('Working periods must be valid non-overlapping local intervals.');
    }
    previousEnd = period.endMinute;
  }

  return ordered.flatMap(({ startMinute, endMinute }) => {
    const starts: number[] = [];
    for (let start = startMinute; start + durationMinutes <= endMinute; start += stepMinutes) {
      starts.push(start);
    }
    return starts;
  });
}
