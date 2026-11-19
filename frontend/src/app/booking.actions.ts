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
  ...[, formData]: [BookingConfirmationState, FormData]
): Promise<BookingConfirmationState> {
  const name = formData.get('customerName');
  const phone = formData.get('customerPhone');
  const result = await createBooking(selection, {
    customerName: typeof name === 'string' ? name : '',
    customerPhone: typeof phone === 'string' ? phone : '',
  });
  if (result.status === BookingConfirmationStatus.Conflict) {
    const { serviceId, specialistId, date } = selection;
    const query = new URLSearchParams({ serviceId, specialistId, date, bookingConflict: '1' });
    redirect(`/?${query}`, RedirectType.replace);
  }
  return result;
}
