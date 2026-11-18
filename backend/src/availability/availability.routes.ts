import { Router } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseLocalDate } from '../validation/local-date.js';
import { isUuid } from '../validation/uuid.js';
import { getScheduleAvailability } from './availability.service.js';
import { availabilityIdErrors } from './constants/availability.constants.js';

export function createAvailabilityRouter(database: PrismaClient): Router {
  const router = Router();

  router.get(
    '/businesses/:businessId/services/:serviceId/specialists/:specialistId/availability',
    async (req, res) => {
      const { businessId, serviceId, specialistId } = req.params;
      for (const [name, code] of availabilityIdErrors) {
        if (!isUuid(req.params[name])) {
          res.status(400).json({ error: { code, message: `${name} must be a valid UUID.` } });
          return;
        }
      }
      const date = parseLocalDate(req.query.date);
      if (!date) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidDate,
            message: 'date must be a valid YYYY-MM-DD date.',
          },
        });
        return;
      }

      const result = await getScheduleAvailability(
        database,
        businessId,
        serviceId,
        specialistId,
        date,
      );
      if (result.error) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result.availability);
    },
  );

  return router;
}
