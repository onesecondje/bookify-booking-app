import type { Booking } from '../../generated/prisma/client.js';
import type { parseLocalDate } from '../../validation/local-date.js';

export type BookingSelection = Pick<Booking, 'businessId' | 'serviceId' | 'specialistId'>;
export type BookingContact = { customerName: string; customerPhone: string };
export type BookingRequest = BookingSelection &
  BookingContact & {
    date: NonNullable<ReturnType<typeof parseLocalDate>>;
    startsAt: string;
  };
export type CreatedBooking = BookingSelection & Pick<Booking, 'id' | 'startsAt' | 'endsAt'>;
