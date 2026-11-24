import express from 'express';
import { createAvailabilityRouter } from './availability/availability.routes.js';
import { createBookingsRouter } from './bookings/bookings.routes.js';
import { createBusinessBookingsRouter } from './bookings/business-bookings.routes.js';
import type { BusinessBookingAccess } from './bookings/types/business-booking-access.types.js';
import type { Express } from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createServicesRouter } from './services/services.routes.js';
import { createSpecialistsRouter } from './specialists/specialists.routes.js';
import { createBusinessScheduleRouter } from './specialists/business-schedule.routes.js';

// Configure request handling without opening a network port.
export function createApp(
  database: PrismaClient,
  businessBookingAccess?: BusinessBookingAccess,
): Express {
  const app: Express = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => {
    return res.status(200).send({ ok: true });
  });

  app.use('/api', createServicesRouter(database));
  app.use('/api', createSpecialistsRouter(database));
  app.use('/api', createAvailabilityRouter(database));
  app.use('/api', createBookingsRouter(database));
  app.use('/api', createBusinessBookingsRouter(database, businessBookingAccess));
  app.use('/api', createBusinessScheduleRouter(database, businessBookingAccess));

  // Register fallback handlers after all routes; the error handler must be last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
