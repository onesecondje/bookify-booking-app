import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Router } from 'express';
import { requireBusinessAccess } from '../bookings/business-booking-access.js';
import type { BusinessBookingAccess } from '../bookings/types/business-booking-access.types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { findBusinessServices, findManagedBusinessServices } from './services.repository.js';
import { isUuid } from '../validation/uuid.js';

export function createServicesRouter(
  database: PrismaClient,
  access?: BusinessBookingAccess,
): Router {
  const router = Router();

  router.get('/businesses/:businessId/services', async (req, res) => {
    const { businessId } = req.params;
    if (!isUuid(businessId)) {
      res.status(400).json({
        error: {
          code: ApiErrorCode.InvalidBusinessId,
          message: 'businessId must be a valid UUID.',
        },
      });
      return;
    }

    const services = await findBusinessServices(database, businessId);
    if (services === null) {
      res.status(404).json({
        error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' },
      });
      return;
    }

    res.json({ services });
  });

  router.get(
    '/businesses/:businessId/manage/services',
    requireBusinessAccess(access),
    async (req, res) => {
      const services = await findManagedBusinessServices(
        database,
        req.params.businessId.toLowerCase(),
      );
      if (services === null) {
        res.status(404).json({
          error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' },
        });
        return;
      }
      res.json({ services });
    },
  );

  return router;
}
