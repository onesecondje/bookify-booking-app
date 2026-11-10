import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';

// One shared pool creates connections on demand and reuses them across queries.
export const pool: Pool = new Pool({
  connectionString: config.databaseUrl,
  application_name: 'bookify-backend',
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  statement_timeout: 5000,
});

// The application owns this external pool; the adapter must not close it.
const adapter = new PrismaPg(pool, { disposeExternalPool: false });
export const prisma = new PrismaClient({ adapter, log: [] });

export async function closeDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
  } finally {
    await pool.end();
  }
}
