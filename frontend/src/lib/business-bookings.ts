import 'server-only';
import { parseBusinessBookings } from './business-bookings.schema';
import { getCatalogueConfig } from './config';
import type { BusinessBooking } from './types/business-bookings.types';
import { isUuid } from './validation/uuid';

export async function getBusinessBookings(): Promise<BusinessBooking[] | null> {
  try {
    const { apiOrigin } = getCatalogueConfig();
    const businessId = process.env.BOOKIFY_MANAGED_BUSINESS_ID;
    const token = process.env.BOOKIFY_BUSINESS_BOOKINGS_TOKEN;
    if (!isUuid(businessId) || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;

    const response = await fetch(new URL(`/api/businesses/${businessId}/bookings`, apiOrigin), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return parseBusinessBookings(await response.json());
  } catch {
    return null;
  }
}
