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
        error: { code: 'INVALID_BUSINESS_ID', message: 'businessId must be a valid UUID.' },
      });
      return;
    }
    if (!isUuid(serviceId)) {
      res.status(400).json({
        error: { code: 'INVALID_SERVICE_ID', message: 'serviceId must be a valid UUID.' },
      });
      return;
    }

    const result = await findServiceSpecialists(database, businessId, serviceId);
    if (result.status === 'business-not-found') {
      res.status(404).json({
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' },
      });
      return;
    }
    if (result.status === 'service-not-found') {
      res.status(404).json({
        error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found.' },
      });
      return;
    }

    res.json({ specialists: result.specialists });
  });

  return router;
}
