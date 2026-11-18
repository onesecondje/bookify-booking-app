import { Temporal } from '@js-temporal/polyfill';
import { LocalTimeStatus } from '../enums/local-time-status.enum.js';
import { generateLocalStartMinutes, type WorkingPeriodMinutes } from './local-starts.js';
import { resolveLocalTime } from './local-time.js';

export type WeeklyWorkingPeriod = WorkingPeriodMinutes & { weekday: number };
export type ScheduleSlot = { startsAt: string; endsAt: string };

// Pure calculation: the caller supplies the current instant for reproducible tests.
// These slots reflect schedules only; bookings and date exceptions are not subtracted yet.
export function generateScheduleSlots({
  date,
  timeZone,
  periods,
  durationMinutes,
  stepMinutes = 15,
  now,
}: {
  date: string;
  timeZone: string;
  periods: readonly WeeklyWorkingPeriod[];
  durationMinutes: number;
  stepMinutes?: number;
  now: string;
}): { slots: ScheduleSlot[]; unresolvedPeriodCount: number } {
  // Validate date/zone even on a day with no working periods.
  resolveLocalTime(date, 0, timeZone);
  const weekday = Temporal.PlainDate.from(date).dayOfWeek;
  const current = Temporal.Instant.from(now);
  generateLocalStartMinutes([], durationMinutes, stepMinutes);

  for (const period of periods) {
    if (!Number.isInteger(period.weekday) || period.weekday < 1 || period.weekday > 7) {
      throw new RangeError('Weekday must be an integer from 1 to 7.');
    }
  }
  // Validate each day's intervals without mixing different weekdays.
  for (let day = 1; day <= 7; day++) {
    generateLocalStartMinutes(
      periods.filter((period) => period.weekday === day),
      1,
      stepMinutes,
    );
  }

  const slots: ScheduleSlot[] = [];
  let unresolvedPeriodCount = 0;
  for (const period of periods.filter((period) => period.weekday === weekday)) {
    const opening = resolveLocalTime(date, period.startMinute, timeZone);
    const closing = resolveLocalTime(date, period.endMinute, timeZone);
    if (opening.status !== LocalTimeStatus.Unique || closing.status !== LocalTimeStatus.Unique) {
      unresolvedPeriodCount++;
      continue;
    }
    const opensAt = Temporal.Instant.from(opening.utc);
    const closesAt = Temporal.Instant.from(closing.utc);
    // Generate the entire local grid; only UTC elapsed-time checks can decide duration fit.
    for (const minute of generateLocalStartMinutes([period], 1, stepMinutes)) {
      const start = resolveLocalTime(date, minute, timeZone);
      const instants =
        start.status === LocalTimeStatus.Unique
          ? [start.utc]
          : start.status === LocalTimeStatus.Ambiguous
            ? [start.earlierUtc, start.laterUtc]
            : [];

      for (const instant of instants) {
        const startsAt = Temporal.Instant.from(instant);
        const endsAt = startsAt.add({ minutes: durationMinutes });
        if (
          Temporal.Instant.compare(startsAt, current) <= 0 ||
          Temporal.Instant.compare(startsAt, opensAt) < 0 ||
          Temporal.Instant.compare(endsAt, closesAt) > 0
        )
          continue;

        slots.push({ startsAt: startsAt.toString(), endsAt: endsAt.toString() });
      }
    }
  }
  slots.sort((a, b) => Temporal.Instant.compare(a.startsAt, b.startsAt));
  return { slots, unresolvedPeriodCount };
}
