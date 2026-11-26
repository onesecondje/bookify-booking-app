import { LocalTimeStatus } from '../enums/local-time-status.enum.js';
import { isTimeZone } from '../validation/time-zone.js';
import { parseLocalDate } from '../validation/local-date.js';
import type { LocalTimeResult } from './types/local-time.types.js';

// Resolve a local clock reading without silently shifting gaps or choosing a fold.
export function resolveLocalTime(date: string, minute: number, timeZone: string): LocalTimeResult {
  const localDate = parseLocalDate(date);
  if (!localDate) {
    throw new RangeError('A valid YYYY-MM-DD local date is required.');
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new RangeError('Local minute must be an integer from 0 to 1440.');
  }
  if (!isTimeZone(timeZone)) {
    throw new RangeError('A valid named IANA time zone is required.');
  }

  const local = localDate.toPlainDateTime('00:00').add({ minutes: minute });
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
