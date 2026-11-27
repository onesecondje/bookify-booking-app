import type { BusinessBooking } from './types/business-bookings.types';
import { isUtcInstant } from './validation/utc-instant';
import { isUuid } from './validation/uuid';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNamedResource(value: unknown): value is BusinessBooking['service'] {
  return isRecord(value) && isUuid(value.id) && typeof value.name === 'string';
}

function isBooking(value: unknown): value is BusinessBooking {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isUtcInstant(value.startsAt) &&
    isUtcInstant(value.endsAt) &&
    Date.parse(value.startsAt) < Date.parse(value.endsAt) &&
    (value.approvedAt === null || isUtcInstant(value.approvedAt)) &&
    (value.cancelledAt === null || isUtcInstant(value.cancelledAt)) &&
    (value.customerName === null || typeof value.customerName === 'string') &&
    (value.customerPhone === null || typeof value.customerPhone === 'string') &&
    isNamedResource(value.service) &&
    isNamedResource(value.specialist)
  );
}

export function parseBusinessBookings(payload: unknown): BusinessBooking[] {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.bookings) ||
    !payload.bookings.every(isBooking)
  ) {
    throw new Error('Invalid business bookings response.');
  }
  return payload.bookings;
}
