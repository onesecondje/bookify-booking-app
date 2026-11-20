import 'server-only';
import { parseBusinessBookings } from './business-bookings.schema';
import { getCatalogueConfig } from './config';
import type { BusinessBooking } from './types/business-bookings.types';
import { isUuid } from './validation/uuid';

function businessBookingsRequest() {
  const { apiOrigin } = getCatalogueConfig();
  const businessId = process.env.BOOKIFY_MANAGED_BUSINESS_ID;
  const token = process.env.BOOKIFY_BUSINESS_BOOKINGS_TOKEN;
  if (!isUuid(businessId) || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token))
    throw new Error('Invalid business bookings configuration.');

  return {
    url: new URL(`/api/businesses/${businessId}/bookings`, apiOrigin),
    options: {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    } satisfies RequestInit,
  };
}

export async function getBusinessBookings(): Promise<BusinessBooking[] | null> {
  try {
    const { url, options } = businessBookingsRequest();
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return parseBusinessBookings(await response.json());
  } catch {
    return null;
  }
}

export async function cancelBusinessBooking(bookingId: string): Promise<boolean> {
  if (!isUuid(bookingId)) return false;
  try {
    const { url, options } = businessBookingsRequest();
    url.pathname += `/${bookingId}/cancel`;
    const response = await fetch(url, { ...options, method: 'PATCH' });
    return response.status === 204;
  } catch {
    return false;
  }
}
