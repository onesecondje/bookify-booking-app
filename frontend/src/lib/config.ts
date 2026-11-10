import 'server-only';
import { isUuid } from './validation/uuid';

export function getCatalogueConfig() {
  const businessId = process.env.BOOKIFY_BUSINESS_ID ?? '10000000-0000-4000-8000-000000000001';
  if (!isUuid(businessId)) throw new Error('Invalid business configuration.');

  const apiOrigin = new URL(process.env.BACKEND_API_URL ?? 'http://127.0.0.1:4000');
  if (!['http:', 'https:'].includes(apiOrigin.protocol)) {
    throw new Error('Invalid API configuration.');
  }

  return { apiOrigin, businessId };
}
