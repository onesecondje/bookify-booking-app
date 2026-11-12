import express from 'express';
import type { Express } from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createServicesRouter } from './services/services.routes.js';
import { createSpecialistsRouter } from './specialists/specialists.routes.js';

// Configure request handling without opening a network port.
export function createApp(database: PrismaClient): Express {
  const app: Express = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => {
    return res.status(200).send({ ok: true });
  });

  app.use('/api', createServicesRouter(database));
  app.use('/api', createSpecialistsRouter(database));

  // Register fallback handlers after all routes; the error handler must be last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
