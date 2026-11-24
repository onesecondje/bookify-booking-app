import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Router } from 'express';
import { requireBusinessAccess } from '../bookings/business-booking-access.js';
import type { BusinessBookingAccess } from '../bookings/types/business-booking-access.types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseServiceUpdate } from './service-update.schema.js';
import {
  findBusinessServices,
  findManagedBusinessServices,
  updateManagedBusinessService,
} from './services.repository.js';
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

  router.put<{ businessId: string; serviceId: string }>(
    '/businesses/:businessId/manage/services/:serviceId',
    requireBusinessAccess(access),
    async (req, res) => {
      const { businessId, serviceId } = req.params;
      if (!isUuid(serviceId)) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidServiceId,
            message: 'serviceId must be a valid UUID.',
          },
        });
        return;
      }
      const update = parseServiceUpdate(req.body);
      if (!update) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidServiceUpdate,
            message: 'Provide a nonblank name, a positive integer duration, and an active status.',
          },
        });
        return;
      }
      if (
        !(await updateManagedBusinessService(database, businessId.toLowerCase(), serviceId, update))
      ) {
        res.status(404).json({
          error: { code: ApiErrorCode.ServiceNotFound, message: 'Service not found.' },
        });
        return;
      }
      res.status(204).end();
    },
  );

  return router;
}
