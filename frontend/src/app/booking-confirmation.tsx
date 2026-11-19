'use client';

import { BookingConfirmationStatus } from '@/enums/booking-confirmation-status.enum';
import { useActionState, useId, useState } from 'react';
import { confirmBooking } from './booking.actions';
import styles from './page.module.css';
import type { BookingConfirmationProps } from './types/booking-selection.types';

export function BookingConfirmation({ selection, timeLabel, timeZone }: BookingConfirmationProps) {
  const [state, action, pending] = useActionState(confirmBooking.bind(null, selection), {
    status: BookingConfirmationStatus.Idle,
  });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const invalidField =
    state.status === BookingConfirmationStatus.InvalidContact ? state.field : undefined;

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
      <div className={styles.bookingContact}>
        <label className={styles.dateField}>
          Name
          <input
            name="customerName"
            autoComplete="name"
            required
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            aria-invalid={invalidField === 'customerName' || undefined}
            aria-describedby={invalidField === 'customerName' ? nameErrorId : undefined}
          />
          {invalidField === 'customerName' && (
            <span id={nameErrorId} className={styles.fieldError} role="alert">
              Enter a name containing 1 to 100 characters.
            </span>
          )}
        </label>
        <label className={styles.dateField}>
          Phone
          <input
            type="tel"
            name="customerPhone"
            autoComplete="tel"
            required
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            aria-invalid={invalidField === 'customerPhone' || undefined}
            aria-describedby={invalidField === 'customerPhone' ? phoneErrorId : undefined}
          />
          {invalidField === 'customerPhone' && (
            <span id={phoneErrorId} className={styles.fieldError} role="alert">
              Enter a phone number with 7 to 15 digits and an optional leading plus.
            </span>
          )}
        </label>
      </div>
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
