'use server';

import { cancelBusinessBooking } from '@/lib/business-bookings';
import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export async function cancelBooking(bookingId: string): Promise<string | null> {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    return 'Sign in again to cancel this booking.';
  }
  if (!(await cancelBusinessBooking(bookingId))) {
    return 'Cancellation could not be confirmed. Refresh the page and try again.';
  }
  revalidatePath('/business');
  return null;
}
