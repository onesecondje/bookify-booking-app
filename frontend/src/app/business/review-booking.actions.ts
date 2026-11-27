'use server';

import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { updateBusinessBooking } from '@/lib/business-bookings';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export async function reviewBooking(
  bookingId: string,
  _previous: string | null,
  formData: FormData,
): Promise<string | null> {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    return 'Sign in again to review this booking.';
  }
  const decision = formData.get('decision');
  if (decision !== 'approve' && decision !== 'reject') {
    return 'Choose whether to approve or reject the booking.';
  }

  const status = await updateBusinessBooking(bookingId, decision);
  if (status === 409) {
    return 'This booking has already been reviewed. Refresh the page to see its status.';
  }
  if (status === 404) {
    return 'This booking is no longer available for review. Refresh the page.';
  }
  if (status !== 204) {
    return 'The decision could not be confirmed. Refresh the page before trying again.';
  }
  revalidatePath('/business');
  return null;
}
