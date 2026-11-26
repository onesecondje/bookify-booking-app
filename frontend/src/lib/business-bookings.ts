import 'server-only';
import { businessApiRequest } from './business-api-request';
import { parseBusinessBookings } from './business-bookings.schema';
import type { BusinessBooking } from './types/business-bookings.types';
import { isUuid } from './validation/uuid';

export async function getBusinessBookings(): Promise<BusinessBooking[] | null> {
  try {
    const { url, options } = businessApiRequest('bookings');
    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }
    return parseBusinessBookings(await response.json());
  } catch {
    return null;
  }
}

export async function cancelBusinessBooking(bookingId: string): Promise<boolean> {
  if (!isUuid(bookingId)) {
    return false;
  }
  try {
    const { url, options } = businessApiRequest('bookings');
    url.pathname += `/${bookingId}/cancel`;
    const response = await fetch(url, { ...options, method: 'PATCH' });
    return response.status === 204;
  } catch {
    return false;
  }
}
