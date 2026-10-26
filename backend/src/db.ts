import { Pool } from 'pg';
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
