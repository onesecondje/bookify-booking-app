import type { BookingContact, BookingSelection } from './types/booking-confirmation.types';

export function parseBookingContactError(payload: unknown): keyof BookingContact | undefined {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return undefined;
  const error = payload.error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  if (error.code === 'INVALID_CUSTOMER_NAME') return 'customerName';
  if (error.code === 'INVALID_CUSTOMER_PHONE') return 'customerPhone';
  return undefined;
}
import { isUtcInstant } from './validation/utc-instant';
import { isUuid } from './validation/uuid';

export function parseBookingId(payload: unknown, selection: BookingSelection, businessId: string) {
  const booking =
    typeof payload === 'object' && payload !== null && 'booking' in payload
      ? payload.booking
      : undefined;
  if (
    typeof booking !== 'object' ||
    booking === null ||
    !('id' in booking) ||
    !isUuid(booking.id) ||
    !('businessId' in booking) ||
    booking.businessId !== businessId.toLowerCase() ||
    !('serviceId' in booking) ||
    booking.serviceId !== selection.serviceId.toLowerCase() ||
    !('specialistId' in booking) ||
    booking.specialistId !== selection.specialistId.toLowerCase() ||
    !('startsAt' in booking) ||
    !isUtcInstant(booking.startsAt) ||
    Date.parse(booking.startsAt) !== Date.parse(selection.startsAt) ||
    !('endsAt' in booking) ||
    !isUtcInstant(booking.endsAt) ||
    Date.parse(booking.endsAt) <= Date.parse(booking.startsAt)
  ) {
    throw new Error('Invalid booking response.');
  }
  return booking.id;
}
