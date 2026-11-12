import { ApiErrorCode } from '../http/api-error-code.js';
import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { findBusinessServices } from './services.repository.js';
import { isUuid } from '../validation/uuid.js';

export function createServicesRouter(database: PrismaClient): Router {
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

  return router;
}
