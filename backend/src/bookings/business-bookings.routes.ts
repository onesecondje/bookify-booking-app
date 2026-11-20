import { Router } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { isUuid } from '../validation/uuid.js';
import {
  cancelUpcomingBusinessBooking,
  findUpcomingBusinessBookings,
} from './bookings.repository.js';
import { matchesBusinessToken } from './business-booking-access.js';
import type { BusinessBookingAccess } from './types/business-booking-access.types.js';

export function createBusinessBookingsRouter(
  database: PrismaClient,
  access?: BusinessBookingAccess,
): Router {
  const router = Router();

  router.use('/businesses/:businessId/bookings', (req, res, next) => {
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
  });

  router.get('/businesses/:businessId/bookings', async (req, res) => {
    const bookings = await findUpcomingBusinessBookings(
      database,
      req.params.businessId.toLowerCase(),
      new Date(),
    );
    res.status(200).json({ bookings });
  });

  router.patch('/businesses/:businessId/bookings/:bookingId/cancel', async (req, res) => {
    const { businessId, bookingId } = req.params;
    if (!isUuid(bookingId)) {
      res.status(400).json({
        error: { code: ApiErrorCode.InvalidBookingId, message: 'bookingId must be a valid UUID.' },
      });
      return;
    }
    if (
      !(await cancelUpcomingBusinessBooking(
        database,
        businessId.toLowerCase(),
        bookingId,
        new Date(),
      ))
    ) {
      res.status(404).json({
        error: { code: ApiErrorCode.BookingNotFound, message: 'Upcoming booking not found.' },
      });
      return;
    }
    res.status(204).end();
  });
  return router;
}
