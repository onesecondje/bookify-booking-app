import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { findBusinessServices } from './services.repository.js';

// Accept canonical UUID text supported by PostgreSQL, without restricting UUID versions.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createServicesRouter(database: PrismaClient): Router {
  const router = Router();

  router.get('/businesses/:businessId/services', async (req, res) => {
    const { businessId } = req.params;
    if (!uuidPattern.test(businessId)) {
      res.status(400).json({
        error: { code: 'INVALID_BUSINESS_ID', message: 'businessId must be a valid UUID.' },
      });
      return;
    }

    const services = await findBusinessServices(database, businessId);
    if (services === null) {
      res.status(404).json({
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business not found.' },
      });
      return;
    }

    res.json({ services });
  });

  return router;
}
