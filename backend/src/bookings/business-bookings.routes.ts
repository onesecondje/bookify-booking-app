import { Router } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { isUuid } from '../validation/uuid.js';
import {
  findUpcomingBusinessBookings,
  updateUpcomingBusinessBooking,
} from './bookings.repository.js';
import { requireBusinessAccess } from './business-booking-access.js';
import { BusinessBookingAction } from './enums/business-booking-action.enum.js';
import type { BusinessBookingAccess } from './types/business-booking-access.types.js';

export function createBusinessBookingsRouter(
  database: PrismaClient,
  access?: BusinessBookingAccess,
): Router {
  const router = Router();

  router.use('/businesses/:businessId/bookings', requireBusinessAccess(access));

  router.get('/businesses/:businessId/bookings', async (req, res) => {
    const bookings = await findUpcomingBusinessBookings(
      database,
      req.params.businessId.toLowerCase(),
      new Date(),
    );
    res.status(200).json({ bookings });
  });

  for (const action of Object.values(BusinessBookingAction)) {
    router.patch<{ businessId: string; bookingId: string }>(
      `/businesses/:businessId/bookings/:bookingId/${action}`,
      async (req, res) => {
        const { businessId, bookingId } = req.params;
        if (!isUuid(bookingId)) {
          res.status(400).json({
            error: {
              code: ApiErrorCode.InvalidBookingId,
              message: 'bookingId must be a valid UUID.',
            },
          });
          return;
        }
        const error = await updateUpcomingBusinessBooking(
          database,
          businessId.toLowerCase(),
          bookingId.toLowerCase(),
          action,
          new Date(),
        );
        if (error === ApiErrorCode.BookingNotFound) {
          res.status(404).json({
            error: { code: error, message: 'Upcoming booking not found.' },
          });
          return;
        }
        if (error === ApiErrorCode.BookingStateConflict) {
          res.status(409).json({
            error: {
              code: error,
              message: 'This action is unavailable for the current booking status.',
            },
          });
          return;
        }
        res.status(204).end();
      },
    );
  }
  return router;
}
