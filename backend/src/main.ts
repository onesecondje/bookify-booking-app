import { once } from 'node:events';
import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = createServer(app);
let shuttingDown = false;

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'UNKNOWN';
}

async function shutdown(exitCode: number): Promise<void> {
  process.exitCode = Math.max(Number(process.exitCode ?? 0), exitCode);

  if (shuttingDown) return;
  shuttingDown = true;

  // A stuck request or connection must not prevent shutdown indefinitely.
  const deadline = setTimeout(() => {
    console.error('Shutdown exceeded 10 seconds. Forcing process exit.');
    process.exit(1);
  }, 10000);
  deadline.unref();

  try {
    try {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      // Let active HTTP requests finish before closing their database connections.
      await pool.end();
    }

    console.log('HTTP server and database pool closed.');
  } catch (error) {
    console.error(`Failed to close server resources (${errorCode(error)}).`);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

// Idle connections can fail outside any HTTP request, so handle pool errors here.
pool.on('error', (error) => {
  console.error(`Unexpected database connection error (${errorCode(error)}).`);
  void shutdown(1);
});

try {
  await pool.query('SELECT 1');

  if (!shuttingDown) {
    console.log('Database connection verified.');
    server.listen(config.port);
    await once(server, 'listening');
    console.log(`Server started on port ${config.port}`);
  }
} catch (error) {
  console.error(
    `Backend startup failed (${errorCode(error)}). Check database availability, credentials, and PORT.`,
  );
  await shutdown(1);
}
