import { Temporal } from '@js-temporal/polyfill';
import { LocalTimeStatus } from '../enums/local-time-status.enum.js';
import { isTimeZone } from '../validation/time-zone.js';

type LocalTimeResult =
  | { status: LocalTimeStatus.Unique; utc: string }
  | { status: LocalTimeStatus.Ambiguous; earlierUtc: string; laterUtc: string }
  | { status: LocalTimeStatus.Nonexistent };

// Resolve a local clock reading without silently shifting gaps or choosing a fold.
export function resolveLocalTime(date: string, minute: number, timeZone: string): LocalTimeResult {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) {
    throw new RangeError('Local date must use YYYY-MM-DD with a year from 0001 to 9999.');
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new RangeError('Local minute must be an integer from 0 to 1440.');
  }
  if (!isTimeZone(timeZone)) throw new RangeError('A valid named IANA time zone is required.');

  const local = Temporal.PlainDate.from(date).toPlainDateTime('00:00').add({ minutes: minute });
  const earlier = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
  const later = local.toZonedDateTime(timeZone, { disambiguation: 'later' });

  // During a forward jump neither interpretation round-trips to the requested clock time.
  if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
    return { status: LocalTimeStatus.Nonexistent };
  }
  if (earlier.epochNanoseconds !== later.epochNanoseconds) {
    return {
      status: LocalTimeStatus.Ambiguous,
      earlierUtc: earlier.toInstant().toString(),
      laterUtc: later.toInstant().toString(),
    };
  }
  return { status: LocalTimeStatus.Unique, utc: earlier.toInstant().toString() };
}
