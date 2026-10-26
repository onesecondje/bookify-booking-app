const portValue = process.env.PORT ?? '4000';
const port = Number(portValue);

// Environment variables are strings; reject invalid values before starting the server.
if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Set it in backend/.env or the environment.');
}

try {
  const url = new URL(databaseUrl);

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length <= 1
  ) {
    throw new Error('Invalid database URL.');
  }
} catch {
  // Never include the connection string in errors: it can contain a password.
  throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name.');
}

export const config = { port, databaseUrl };
