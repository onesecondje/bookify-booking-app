import 'server-only';
import { BookingConfirmationStatus } from '../enums/booking-confirmation-status.enum';
import { parseBookingContactError, parseBookingId } from './bookings.schema';
import { getCatalogueConfig } from './config';
import type {
  BookingConfirmationResult,
  BookingContact,
  BookingSelection,
} from './types/booking-confirmation.types';
import { isLocalDate } from './validation/local-date';
import { isUtcInstant } from './validation/utc-instant';
import { isUuid } from './validation/uuid';

export async function createBooking(
  selection: BookingSelection,
  contact: BookingContact,
): Promise<BookingConfirmationResult> {
  const { serviceId, specialistId, date, startsAt } = selection;
  if (
    !isUuid(serviceId) ||
    !isUuid(specialistId) ||
    !isLocalDate(date) ||
    !isUtcInstant(startsAt)
  ) {
    return { status: BookingConfirmationStatus.Unavailable };
  }

  try {
    const { apiOrigin, businessId } = getCatalogueConfig();
    const url = new URL(
      `/api/businesses/${businessId}/services/${serviceId}/specialists/${specialistId}/bookings`,
      apiOrigin,
    );
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, startsAt, ...contact }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 409) return { status: BookingConfirmationStatus.Conflict };
    if (response.status === 400) {
      const field = parseBookingContactError(await response.json());
      if (field) return { status: BookingConfirmationStatus.InvalidContact, field };
    }
    if (response.status !== 201) throw new Error('Booking request failed.');

    return {
      status: BookingConfirmationStatus.Confirmed,
      bookingId: parseBookingId(await response.json(), selection, businessId),
    };
  } catch {
    console.error('Unable to confirm booking.');
    return { status: BookingConfirmationStatus.Unavailable };
  }
}
