import { ServiceSpecialistsStatus } from '../enums/service-specialists-status.enum.js';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { isUuid } from '../validation/uuid.js';
import { findServiceSpecialists } from './specialists.repository.js';

export function createSpecialistsRouter(database: PrismaClient): Router {
  const router = Router();

  router.get('/businesses/:businessId/services/:serviceId/specialists', async (req, res) => {
    const { businessId, serviceId } = req.params;
    if (!isUuid(businessId)) {
      res.status(400).json({
        error: {
          code: ApiErrorCode.InvalidBusinessId,
          message: 'businessId must be a valid UUID.',
        },
      });
      return;
    }
    if (!isUuid(serviceId)) {
      res.status(400).json({
        error: { code: ApiErrorCode.InvalidServiceId, message: 'serviceId must be a valid UUID.' },
      });
      return;
    }

    const result = await findServiceSpecialists(database, businessId, serviceId);
    if (result.status === ServiceSpecialistsStatus.BusinessNotFound) {
      res.status(404).json({
        error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' },
      });
      return;
    }
    if (result.status === ServiceSpecialistsStatus.ServiceNotFound) {
      res.status(404).json({
        error: { code: ApiErrorCode.ServiceNotFound, message: 'Service not found.' },
      });
      return;
    }

    res.json({ specialists: result.specialists });
  });

  return router;
}
