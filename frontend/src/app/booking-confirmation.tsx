'use client';

import { BookingConfirmationStatus } from '@/enums/booking-confirmation-status.enum';
import { useActionState } from 'react';
import { confirmBooking } from './booking.actions';
import styles from './page.module.css';
import type { BookingConfirmationProps } from './types/booking-selection.types';

export function BookingConfirmation({ selection, timeLabel, timeZone }: BookingConfirmationProps) {
  const [state, action, pending] = useActionState(confirmBooking.bind(null, selection), {
    status: BookingConfirmationStatus.Idle,
  });

  if (state.status === BookingConfirmationStatus.Confirmed) {
    return (
      <div className={styles.slotResults} role="status">
        <strong>Booking confirmed</strong>
        <p>
          {selection.date} at {timeLabel} ({timeZone})
        </p>
        <p className={styles.bookingReference}>Reference {state.bookingId}</p>
      </div>
    );
  }

  return (
    <form action={action}>
      <button className={styles.retry} disabled={pending} type="submit">
        {pending ? 'Confirming…' : 'Confirm booking'}
      </button>
      {state.status === BookingConfirmationStatus.Unavailable && (
        <p role="status">
          We couldn’t verify your booking. Refresh available times before trying again.
        </p>
      )}
    </form>
  );
}
