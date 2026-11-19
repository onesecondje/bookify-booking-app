import { Router } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { findUpcomingBusinessBookings } from './bookings.repository.js';
import { matchesBusinessToken } from './business-booking-access.js';
import type { BusinessBookingAccess } from './types/business-booking-access.types.js';

export function createBusinessBookingsRouter(
  database: PrismaClient,
  access?: BusinessBookingAccess,
): Router {
  const router = Router();

  router.get('/businesses/:businessId/bookings', async (req, res) => {
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

    const bookings = await findUpcomingBusinessBookings(database, access.businessId, new Date());
    res.status(200).json({ bookings });
  });
  return router;
}
