import express from 'express';
import type { Express } from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';

// Configure request handling without opening a network port.
export const app: Express = express();

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  return res.status(200).send({ ok: true });
});

// Register fallback handlers after all routes; the error handler must be last.
app.use(notFound);
app.use(errorHandler);
