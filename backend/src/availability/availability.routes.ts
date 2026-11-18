import { Router } from 'express';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseLocalDate } from '../validation/local-date.js';
import { isUuid } from '../validation/uuid.js';
import { findAvailabilitySchedule } from './availability.repository.js';
import { availabilityIdErrors } from './constants/availability.constants.js';
import { generateScheduleSlots } from './schedule-slots.js';

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

      const business = await findAvailabilitySchedule(
        database,
        businessId,
        serviceId,
        specialistId,
        date.dayOfWeek,
      );
      if (!business) {
        res
          .status(404)
          .json({ error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' } });
        return;
      }
      const service = business.services[0];
      if (!service) {
        res
          .status(404)
          .json({ error: { code: ApiErrorCode.ServiceNotFound, message: 'Service not found.' } });
        return;
      }
      const assignment = service.specialists[0];
      if (!assignment) {
        res.status(404).json({
          error: {
            code: ApiErrorCode.SpecialistNotFound,
            message: 'Specialist not found for this service.',
          },
        });
        return;
      }

      const localDate = date.toString();
      const result = generateScheduleSlots({
        date: localDate,
        timeZone: business.timeZone,
        periods: assignment.specialist.workingPeriods,
        durationMinutes: service.durationMinutes,
        now: new Date().toISOString(),
      });
      res.json({ date: localDate, timeZone: business.timeZone, ...result });
    },
  );

  return router;
}
