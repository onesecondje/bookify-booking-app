import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Router } from 'express';
import { requireBusinessAccess } from '../bookings/business-booking-access.js';
import type { BusinessBookingAccess } from '../bookings/types/business-booking-access.types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseServiceCreation, parseServiceUpdate } from './service-update.schema.js';
import {
  createManagedBusinessService,
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

  router.post(
    '/businesses/:businessId/manage/services',
    requireBusinessAccess(access),
    async (req, res) => {
      const data = parseServiceCreation(req.body);
      if (!data) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.InvalidServiceCreation,
            message: 'Provide a name, a positive integer duration, and distinct specialist IDs.',
          },
        });
        return;
      }
      const service = await createManagedBusinessService(
        database,
        req.params.businessId.toLowerCase(),
        data,
      );
      if (!service) {
        res.status(404).json({
          error: {
            code: ApiErrorCode.SpecialistNotFound,
            message: 'One or more selected specialists are unavailable.',
          },
        });
        return;
      }
      res.status(201).json({ service });
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
            message:
              'Provide a name, a positive integer duration, an active status, and distinct specialist IDs if supplied.',
          },
        });
        return;
      }
      const error = await updateManagedBusinessService(
        database,
        businessId.toLowerCase(),
        serviceId.toLowerCase(),
        update,
      );
      if (error) {
        res.status(404).json({
          error: {
            code: error,
            message:
              error === ApiErrorCode.ServiceNotFound
                ? 'Service not found.'
                : 'One or more selected specialists are unavailable.',
          },
        });
        return;
      }
      res.status(204).end();
    },
  );

  return router;
}
