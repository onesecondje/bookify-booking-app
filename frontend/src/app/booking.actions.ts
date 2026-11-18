'use server';

import { BookingConfirmationStatus } from '@/enums/booking-confirmation-status.enum';
import { createBooking } from '@/lib/bookings';
import type {
  BookingConfirmationState,
  BookingSelection,
} from '@/lib/types/booking-confirmation.types';
import { redirect, RedirectType } from 'next/navigation';

export async function confirmBooking(
  selection: BookingSelection,
): Promise<BookingConfirmationState> {
  const result = await createBooking(selection);
  if (result.status === BookingConfirmationStatus.Conflict) {
    const { serviceId, specialistId, date } = selection;
    const query = new URLSearchParams({ serviceId, specialistId, date, bookingConflict: '1' });
    redirect(`/?${query}`, RedirectType.replace);
  }
  return result;
}
