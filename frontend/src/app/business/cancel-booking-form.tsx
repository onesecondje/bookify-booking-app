'use client';

import { useActionState } from 'react';
import { cancelBooking } from './cancel-booking.actions';
import type { CancelBookingFormProps } from './types/cancel-booking-form.types';

export function CancelBookingForm({ bookingId }: CancelBookingFormProps) {
  const [error, action, pending] = useActionState(cancelBooking.bind(null, bookingId), null);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm('Cancel this booking and release its time slot?')) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" disabled={pending}>
        {pending ? 'Cancelling…' : 'Cancel booking'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
