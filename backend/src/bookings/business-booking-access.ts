import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { isUuid } from '../validation/uuid.js';
import type { BusinessBookingAccess } from './types/business-booking-access.types.js';

export function parseBusinessBookingAccess(
  businessId: string | undefined,
  token: string | undefined,
): BusinessBookingAccess | undefined {
  if (!businessId && !token) {
    return undefined;
  }
  if (!isUuid(businessId) || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    throw new Error('Invalid business bookings access configuration.');
  }
  return { businessId: businessId.toLowerCase(), token };
}

export function matchesBusinessToken(header: string | undefined, token: string): boolean {
  const supplied = /^Bearer ([A-Za-z0-9_-]{32,128})$/i.exec(header ?? '')?.[1];
  if (!supplied) {
    return false;
  }
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(token));
}

export function requireBusinessAccess(
  access?: BusinessBookingAccess,
): RequestHandler<{ businessId: string }> {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!access || !matchesBusinessToken(req.get('Authorization'), access.token)) {
      res
        .set('WWW-Authenticate', 'Bearer')
        .status(401)
        .json({
          error: { code: ApiErrorCode.Unauthorized, message: 'Business credentials are required.' },
        });
      return;
    }
    if (req.params.businessId.toLowerCase() !== access.businessId) {
      res.status(403).json({
        error: { code: ApiErrorCode.Forbidden, message: 'Access to this business is forbidden.' },
      });
      return;
    }
    next();
  };
}
