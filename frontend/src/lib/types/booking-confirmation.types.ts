import type { BookingConfirmationStatus } from '../../enums/booking-confirmation-status.enum';

export type BookingSelection = {
  serviceId: string;
  specialistId: string;
  date: string;
  startsAt: string;
};

export type BookingConfirmationResult =
  | { status: BookingConfirmationStatus.Confirmed; bookingId: string }
  | { status: BookingConfirmationStatus.Conflict }
  | { status: BookingConfirmationStatus.InvalidContact; field: keyof BookingContact }
  | { status: BookingConfirmationStatus.Unavailable };

export type BookingConfirmationState =
  | Exclude<BookingConfirmationResult, { status: BookingConfirmationStatus.Conflict }>
  | { status: BookingConfirmationStatus.Idle };

export type BookingContact = { customerName: string; customerPhone: string };
