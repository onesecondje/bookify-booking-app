import express from 'express';
import type { Express } from 'express';

// Configure request handling without opening a network port.
export const app: Express = express();

app.get('/api/health', (req, res) => {
  return res.status(200).send({ ok: true });
});
