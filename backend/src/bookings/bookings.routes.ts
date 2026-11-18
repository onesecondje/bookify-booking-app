import { Router } from 'express';
import { availabilityIdErrors } from '../availability/constants/availability.constants.js';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseLocalDate } from '../validation/local-date.js';
import { parseUtcInstant } from '../validation/utc-instant.js';
import { isUuid } from '../validation/uuid.js';
import { createBooking } from './bookings.service.js';

export function createBookingsRouter(database: PrismaClient): Router {
  const router = Router();

  router.post(
    '/businesses/:businessId/services/:serviceId/specialists/:specialistId/bookings',
    async (req, res) => {
      const { businessId, serviceId, specialistId } = req.params;
      for (const [name, code] of availabilityIdErrors) {
        if (!isUuid(req.params[name])) {
          res.status(400).json({ error: { code, message: `${name} must be a valid UUID.` } });
          return;
        }
      }

      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        res.status(400).json({
          error: { code: ApiErrorCode.InvalidBookingBody, message: 'Expected a JSON object.' },
        });
        return;
      }
      const date = parseLocalDate('date' in body ? body.date : undefined);
      if (!date) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidDate,
            message: 'date must be a valid YYYY-MM-DD date.',
          },
        });
        return;
      }
      const startsAt = parseUtcInstant('startsAt' in body ? body.startsAt : undefined);
      if (!startsAt) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidStartsAt,
            message: 'startsAt must be a UTC timestamp ending in Z.',
          },
        });
        return;
      }

      const result = await createBooking(database, {
        businessId,
        serviceId,
        specialistId,
        date,
        startsAt,
      });
      if (result.status === 201) {
        res.status(result.status).json({ booking: result.booking });
        return;
      }
      res.status(result.status).json({ error: result.error });
    },
  );
  return router;
}
