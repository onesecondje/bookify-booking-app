import 'server-only';
import { getCatalogueConfig } from './config';
import { isUuid } from './validation/uuid';

export function businessApiRequest(resource: 'bookings' | 'schedule' | 'manage/services') {
  const { apiOrigin } = getCatalogueConfig();
  const businessId = process.env.BOOKIFY_MANAGED_BUSINESS_ID;
  const token = process.env.BOOKIFY_BUSINESS_BOOKINGS_TOKEN;
  if (!isUuid(businessId) || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token))
    throw new Error('Invalid business API configuration.');

  return {
    url: new URL(`/api/businesses/${businessId}/${resource}`, apiOrigin),
    options: {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    } satisfies RequestInit,
  };
}
