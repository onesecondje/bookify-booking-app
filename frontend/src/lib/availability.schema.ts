import { availabilityNotFoundStatuses } from './constants/availability.constants';
import type { Availability, AvailabilitySlot } from './types/availability.types';
import { isLocalDate } from './validation/local-date';

function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }

  const instant = new Date(value);
  // Date can normalize invalid calendar dates and 24:00.
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().split('.')[0] === value.replace(/(?:\.\d+)?Z$/, '')
  );
}

function isAvailabilitySlot(value: unknown): value is AvailabilitySlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startsAt' in value &&
    isUtcInstant(value.startsAt) &&
    'endsAt' in value &&
    isUtcInstant(value.endsAt) &&
    Date.parse(value.startsAt) < Date.parse(value.endsAt)
  );
}

export function parseAvailabilityResponse(payload: unknown): Availability {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('date' in payload) ||
    !isLocalDate(payload.date) ||
    !('timeZone' in payload) ||
    !isTimeZone(payload.timeZone) ||
    !('slots' in payload) ||
    !Array.isArray(payload.slots) ||
    !payload.slots.every(isAvailabilitySlot) ||
    !('unresolvedPeriodCount' in payload) ||
    typeof payload.unresolvedPeriodCount !== 'number' ||
    !Number.isSafeInteger(payload.unresolvedPeriodCount) ||
    payload.unresolvedPeriodCount < 0
  ) {
    throw new Error('Invalid availability response.');
  }

  return {
    date: payload.date,
    timeZone: payload.timeZone,
    slots: payload.slots.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
    unresolvedPeriodCount: payload.unresolvedPeriodCount,
  };
}

export function parseAvailabilityNotFoundStatus(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('error' in payload) ||
    typeof payload.error !== 'object' ||
    payload.error === null ||
    !('code' in payload.error) ||
    typeof payload.error.code !== 'string'
  ) {
    throw new Error('Invalid availability error response.');
  }

  const status = availabilityNotFoundStatuses.get(payload.error.code);
  if (status === undefined) throw new Error('Invalid availability error response.');
  return status;
}
