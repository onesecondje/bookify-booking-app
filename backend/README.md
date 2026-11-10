# Bookify Backend

API for booking appointments with service providers. Built with Express 5,
TypeScript, and ESM.

## Getting started

Use Node.js 24 or newer and pnpm.

Run these commands from the repository root:

```sh
pnpm -C backend install
docker compose up -d --wait postgres
```

Create `backend/.env` from `backend/.env.example` if it does not already exist,
and set `DATABASE_URL` to match your database credentials. Apply migrations and
start the API:

```sh
pnpm -C backend db:migrate
pnpm -C backend dev
```

The server defaults to port `4000`. Automatic restarts on file changes are not
configured yet. If pnpm is not available directly, run `corepack pnpm` instead.

## Environment configuration

Copy `backend/.env.example` to `backend/.env` on first setup, set `DATABASE_URL`,
and optionally change `PORT`.
From the repository root in PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

The development command uses Node.js's `--env-file-if-exists=.env` flag to load
the file before application modules run. The path is relative to the backend
working directory. Do not overwrite an existing file. The file is optional if
required settings are provided through environment variables instead.
Variables already set in the process environment take precedence over the file.
Other startup commands must explicitly load the file or supply environment variables.

`src/config.ts` converts `process.env.PORT` from a string to a number and validates
it before the server starts. An unset value defaults to `4000`; an empty,
non-numeric, fractional, or out-of-range value stops startup with a clear error.
The allowed range is `1` through `65535`.

To override the port for one PowerShell session:

```powershell
$env:PORT = '4100'
pnpm -C backend dev
# After stopping the server, remove the override to use .env or the default again.
Remove-Item Env:PORT
```

Keep `.env` local: it is ignored by Git. Commit `.env.example` with non-secret
examples so other developers know which configuration options exist.

### Database connection string

`DATABASE_URL` is required. It must be a `postgres://` or `postgresql://` URL with
a host and database name. The example in `backend/.env.example` matches the root
Compose example; update it if you changed the root `.env` settings.

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

The backend runs on the host, so use `127.0.0.1` and the published database port.
The Compose service name `postgres` is a hostname for containers on the Compose
network; it is not the database hostname for the host Node.js process.
Percent-encode special characters in URL credentials, such as `@`, `#`, or `/`.
Never log the URL or commit real credentials.

URL validation only checks its structure. The startup SQL query verifies that
the database is reachable and that its credentials are accepted.

## Database pool and process lifecycle

`src/db.ts` exports one shared `pg.Pool`. Constructing a pool does not immediately
open connections: it creates them on demand, up to a maximum of 10. Reusing
connections avoids performing a new connection handshake for every HTTP request.

For a single query, use `await pool.query(sql, parameters)`. The pool borrows and
releases a connection automatically. Future transactions will need an explicitly
checked-out client, with release in a `finally` block so the pool cannot leak clients.

Current limits:

- Connection acquisition timeout: 5 seconds.
- Database statement timeout: 5 seconds.
- Idle connection timeout: 10 seconds.
- Maximum connections: 10 per backend process, not across all backend instances.

Startup in `src/main.ts` follows this order:

```text
Validate configuration → SELECT 1 → Start listening for HTTP requests
```

If the connection check or HTTP startup fails, the backend closes its resources
and exits with a nonzero code. Logs include an error code without the connection
string. For example, `28P01` indicates rejected password authentication,
`ECONNREFUSED` indicates a refused connection, and `EADDRINUSE` means the HTTP port
is already occupied. Missing or malformed configuration fails during module loading,
before the pool is created.

On `SIGINT` (normally Ctrl+C) or `SIGTERM`, shutdown first stops accepting new HTTP
connections and waits for active requests, then calls `pool.end()` to close database
connections. Repeated shutdown requests do not close the pool twice. An unexpected
error on an idle pool connection also initiates shutdown, with a nonzero exit code.
A 10-second deadline forces termination if shutdown cannot complete. A forced OS
termination cannot run this cleanup; signal support varies by operating system.

## Database migrations

### Prisma transition: introspection only

Prisma CLI, Client, and the PostgreSQL adapter are pinned to 7.10.1. The API still
uses `pg.Pool`, and `db:migrate` still runs the existing SQL migration runner.
Prisma Migrate has not been baselined yet. Do not run `db push`, `migrate dev`, or
`migrate reset` against the application database during this intermediate step.

`prisma7.config.ts` loads an optional backend `.env` with Node.js's built-in
`loadEnvFile`; existing process variables take precedence. Run Prisma commands
from the backend directory, or use these scripts from the repository root:

```sh
pnpm -C backend db:validate
pnpm -C backend db:generate
pnpm -C backend db:introspect
```

Introspection reads the database and updates `prisma/schema.prisma`; it does not
alter database tables. Review its diff before keeping changes. Generation writes
the ESM TypeScript client to `src/generated/prisma`, which is ignored by Git and
ESLint. Run generation after installing dependencies and after model changes.
The application TypeScript configuration includes `src`; the CLI configuration
is outside the application's compilation root.

`Business` and `Service` use `@map` and `@@map` to preserve existing snake_case
database names. UUIDs remain database-generated via `gen_random_uuid()`, timestamps
remain `timestamptz(6)`, and the service relation explicitly preserves delete
restriction and `ON UPDATE NO ACTION`. PostgreSQL still enforces all four CHECK
constraints; Prisma schema cannot fully represent them. The baseline SQL must
include these constraints before adopting Prisma Migrate.

`LegacyMigration` temporarily describes `schema_migrations`. Its `@@ignore`
excludes it from Prisma Client, not from migration management. During baselining,
archive the old history outside the managed schema and remove this model before
creating the baseline. Only then retire the existing migration runner.

Run `pnpm -C backend db:migrate` from the repository root to create or update the
schema. The initial migration creates `businesses` and `services`, with a foreign
key linking each service to its business. `schema_migrations` records applied files
and checksums so subsequent runs only apply new files.

The migration runner uses a single transaction and connection. A failed batch
rolls back both SQL changes and history entries. A database advisory lock prevents
two cooperating runners from applying the same migration at the same time.
Migrations are separate from HTTP startup and do not insert demonstration data.

See [migration documentation](migrations/README.md) for column definitions,
constraints, file naming, transactions, and limitations.

## Express application and HTTP server

- `src/app.ts` creates and exports the Express application, `app`. It defines
  request handling and registers the JSON parser, routes, and fallback handlers.
  Importing this module does not open a network port.
- `src/main.ts` is the process entry point. It imports `app` and calls
  `createServer(app)`. It verifies the database connection before calling
  `server.listen(config.port)`, and owns shutdown of both the HTTP server and pool.
  `src/config.ts` reads and validates the port and database URL.

Request flow:

```text
Client → HTTP server → JSON parser → Route handler → Response to client
                                  → Not-found handler (no matching route)
                     → Error handler (parsing or request processing fails)
```

This separation allows future tests to import the application without
automatically starting a server on a fixed port. Startup and shutdown logic
belongs in the entry point.

### Why import `./app.js` when the source file is `app.ts`?

The backend uses `"type": "module"` and TypeScript's `module: "nodeNext"` setting.
Relative imports use the emitted JavaScript file extension: `app.ts` compiles to
`app.js`, so Node.js can resolve the module after compilation. TypeScript resolves
the corresponding `.ts` source file during type checking, and `tsx` supports this
import when running the source code directly.

## JSON requests and error handling

`express.json({ limit: '100kb' })` parses requests with a JSON content type before
route handlers run. Parsed data is available as `req.body`; it is still untrusted
input. Parsing JSON does not validate required fields or enforce booking rules.
Other content types are not parsed by this middleware.

Middleware runs in registration order. Normal middleware uses `next()` to continue
processing. `next(error)` skips normal handlers and forwards the error to an error
handler. Express 5 also forwards errors thrown by route handlers and rejected
promises returned by async route handlers.

After all routes, `notFound` returns a JSON `404` for unmatched requests. A missing
route does not automatically throw an error in Express, so it needs its own handler.
The final `errorHandler` uses four arguments `(error, req, res, next)`; Express uses
this signature to distinguish error handlers from ordinary middleware.

Errors use a consistent response structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found."
  }
}
```

| Status | Code                     | Meaning                                            |
| ------ | ------------------------ | -------------------------------------------------- |
| 400    | `INVALID_JSON`           | The JSON parser rejected the body                  |
| 404    | `NOT_FOUND`              | No route matched the request                       |
| 413    | `PAYLOAD_TOO_LARGE`      | The body exceeds the 100kb parsing limit           |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | The JSON parser does not support the body encoding |
| 500    | `INTERNAL_SERVER_ERROR`  | An unexpected request processing error occurred    |

Malformed JSON is rejected before route matching, so it can produce `400` even
when sent to an unknown route. The parser accepts JSON objects and arrays by
default; standalone primitives are rejected. The server logs unexpected errors,
but responses do not expose stack traces or internal error messages. If a response
has already started, the error is forwarded to Express's default error handler.

To check a missing route and malformed JSON from PowerShell (using curl.exe):

```powershell
curl.exe -i http://localhost:4000/api/missing
'{"name":' | curl.exe -i -X POST http://localhost:4000/api/missing -H 'Content-Type: application/json' --data-binary '@-'
```

Expect `404` with `NOT_FOUND` for the first request and `400` with `INVALID_JSON`
for the second. No booking or other POST endpoints have been implemented yet.

## Verification

```sh
pnpm -C backend lint
pnpm -C backend exec tsc --noEmit
pnpm -C backend test
```

After starting the server, send `GET http://localhost:4000/api/health`, for example
using PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Expect HTTP `200` with JSON `{ "ok": true }`.
This endpoint checks that the HTTP server responds. The database is verified at
startup, not on every health request; a later database outage does not necessarily
make this endpoint fail. Apply migrations explicitly before using application tables.

The test command runs database integration tests using Node.js's built-in test
runner. PostgreSQL must be available and `DATABASE_URL` must be configured. Tests
use temporary schemas to verify migration behavior and table constraints without
changing application tables.
