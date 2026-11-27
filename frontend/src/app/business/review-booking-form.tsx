'use client';

import { useActionState } from 'react';
import { reviewBooking } from './review-booking.actions';
import type { ReviewBookingFormProps } from './types/review-booking-form.types';

export function ReviewBookingForm({ bookingId }: ReviewBookingFormProps) {
  const [error, action, pending] = useActionState(reviewBooking.bind(null, bookingId), null);
  return (
    <form action={action}>
      <button type="submit" name="decision" value="approve" disabled={pending}>
        Approve
      </button>
      <button type="submit" name="decision" value="reject" disabled={pending}>
        Reject
      </button>
      {pending && <p role="status">Saving decision…</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
