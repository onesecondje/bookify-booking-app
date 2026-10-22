const portValue = process.env.PORT ?? '4000';
const port = Number(portValue);

// Environment variables are strings; reject invalid values before starting the server.
if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const config = { port };
