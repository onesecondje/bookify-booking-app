import { Router } from 'express';
import { requireBusinessAccess } from '../bookings/business-booking-access.js';
import type { BusinessBookingAccess } from '../bookings/types/business-booking-access.types.js';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { isUuid } from '../validation/uuid.js';
import { findBusinessSchedule, replaceSpecialistWorkingDay } from './specialists.repository.js';
import { parseWorkingHours } from './working-hours.schema.js';

export function createBusinessScheduleRouter(
  database: PrismaClient,
  access?: BusinessBookingAccess,
): Router {
  const router = Router();
  router.get(
    '/businesses/:businessId/schedule',
    requireBusinessAccess(access),
    async (req, res) => {
      const { specialistId } = req.query;
      if (specialistId !== undefined && !isUuid(specialistId)) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidSpecialistId,
            message: 'specialistId must be a valid UUID.',
          },
        });
        return;
      }
      const result = await findBusinessSchedule(
        database,
        req.params.businessId.toLowerCase(),
        specialistId?.toLowerCase(),
      );
      if (!result) {
        res.status(404).json({
          error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' },
        });
        return;
      }

      res.status(200).json(result);
    },
  );
  router.put<{ businessId: string; specialistId: string; weekday: string }>(
    '/businesses/:businessId/schedule/:specialistId/:weekday',
    requireBusinessAccess(access),
    async (req, res) => {
      const { businessId, specialistId, weekday } = req.params;
      if (!isUuid(specialistId)) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidSpecialistId,
            message: 'specialistId must be a valid UUID.',
          },
        });
        return;
      }

      const periods = parseWorkingHours(req.body);
      if (!/^[1-7]$/.test(weekday) || !periods) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidWorkingHours,
            message: 'Provide a weekday and non-overlapping working hours.',
          },
        });
        return;
      }

      try {
        if (
          !(await replaceSpecialistWorkingDay(
            database,
            businessId.toLowerCase(),
            specialistId.toLowerCase(),
            Number(weekday),
            periods,
          ))
        ) {
          res.status(404).json({
            error: { code: ApiErrorCode.SpecialistNotFound, message: 'Specialist not found.' },
          });
          return;
        }
        res.status(204).end();
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          (error.code !== 'P2034' && error.code !== 'P2039')
        ) {
          throw error;
        }
        res.status(409).json({
          error: {
            code: ApiErrorCode.ScheduleConflict,
            message: 'The schedule changed. Refresh and try again.',
          },
        });
      }
    },
  );
  return router;
}
