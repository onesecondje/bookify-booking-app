import { createHash, timingSafeEqual } from 'node:crypto';
import { isUuid } from '../validation/uuid.js';
import type { BusinessBookingAccess } from './types/business-booking-access.types.js';

export function parseBusinessBookingAccess(
  businessId: string | undefined,
  token: string | undefined,
): BusinessBookingAccess | undefined {
  if (!businessId && !token) return undefined;
  if (!isUuid(businessId) || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    throw new Error('Invalid business bookings access configuration.');
  }
  return { businessId: businessId.toLowerCase(), token };
}

export function matchesBusinessToken(header: string | undefined, token: string): boolean {
  const supplied = /^Bearer ([A-Za-z0-9_-]{32,128})$/i.exec(header ?? '')?.[1];
  if (!supplied) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(token));
}
