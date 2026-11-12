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

`src/db.ts` exports one shared Prisma Client and one underlying `pg.Pool`.
The pool is passed to `PrismaPg`, so Prisma reuses the same connections and limits.
Creating the objects does not open connections immediately. The application owns
the external pool; `disposeExternalPool: false` prevents the adapter from closing it.

Application data access should use `prisma` from `src/db.ts`, for example:

```ts
import { prisma } from './db.js';

const services = await prisma.service.findMany({ where: { businessId } });
```

This is an example, not an implemented route. Use Prisma's transaction API for
future multi-query transactions; do not mix Prisma operations and a separately
checked-out pg connection expecting them to share a transaction.

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
connections and waits for active requests, then calls `closeDatabase()`: Prisma disconnects first, and the application closes
the external pool in a finally block even if disconnection fails. Repeated shutdown requests do not close the pool twice. An unexpected
error on an idle pool connection also initiates shutdown, with a nonzero exit code.
A 10-second deadline forces termination if shutdown cannot complete. A forced OS
termination cannot run this cleanup; signal support varies by operating system.

## Database migrations

Prisma CLI, Client, and the PostgreSQL adapter are pinned to 7.10.1. Prisma Migrate
owns schema changes in `prisma/migrations`; the API uses Prisma Client through
`PrismaPg` and the shared `pg.Pool`. Migrations run explicitly, separately from HTTP startup.

Run these commands from the repository root:

```sh
pnpm -C backend db:migrate
pnpm -C backend db:status
pnpm -C backend db:validate
pnpm -C backend db:generate
```

`db:migrate` runs `prisma migrate deploy`: it applies pending migration SQL and
records history in `_prisma_migrations`. It does not generate the client or detect
all schema drift. `db:status` checks migration history; it is not a full schema audit.

`prisma7.config.ts` loads an optional backend `.env` using Node.js's built-in
`loadEnvFile`; existing environment variables take precedence. The application
TypeScript configuration includes `src`; the CLI configuration is outside that root.

`db:generate` writes the ESM TypeScript client to `src/generated/prisma`, ignored
by Git, ESLint, and Prettier. Run it after dependency installation and model changes.
`db:introspect` reads the database and updates `prisma/schema.prisma`; review its
diff before keeping changes. Neither command changes database tables.

Models preserve snake_case database names, database-generated UUIDs, timestamptz(6),
foreign key actions, and the business lookup index. All four CHECK constraints
are explicitly included in baseline SQL because Prisma schema cannot fully express them.

See [migration documentation](prisma/migrations/README.md) for baseline adoption,
future migrations, transaction behavior, and integration tests.

## Specialists

The database also contains Specialist and SpecialistService models. Specialists
belong to a business; explicit service assignments support many-to-many relations.
Composite foreign keys prevent cross-business assignments, and a composite primary
key prevents duplicates. Names must be nonblank; active defaults to true. Referenced
specialists/services cannot be deleted while assignments exist. See the migration
documentation for key/index details. A public specialist endpoint is available for
a selected service (see below). Specialist selection UI is not implemented yet;
the explicit demo seed includes specialists and service assignments.

## Demonstration data

After migrations and client generation, populate the local development database:

```sh
pnpm -C backend db:seed
```

Prisma's `migrations.seed` configuration runs `src/seed.ts`, which uses the shared
Prisma Client, calls `seedDemoData` from `src/demo-data.ts`, and closes database
resources. Seeding is explicit; API startup and migration deployment do not run it.

The demo business is **Bookify Demo Studio**, time zone **Europe/Warsaw**, with ID
`10000000-0000-4000-8000-000000000001`. The small dataset does not limit how many
businesses the application can support.

| Service       | Duration (minutes) | Active |
| ------------- | ------------------ | ------ |
| Haircut       | 30                 | Yes    |
| Beard trim    | 15                 | Yes    |
| Hair coloring | 90                 | No     |

The demo also includes two active specialists and three assignments:

| Specialist | UUID                                 | Assigned services   |
| ---------- | ------------------------------------ | ------------------- |
| Alice      | 30000000-0000-4000-8000-000000000001 | Haircut, Beard trim |
| Alex       | 30000000-0000-4000-8000-000000000002 | Haircut             |

Inactive Hair coloring remains unassigned. This demonstrates both directions of
the many-to-many relation without defining a limit on specialists or assignments.

Each demo record has a stable UUID. Upserts identify records by that UUID, so
renaming one does not create a duplicate on the next seed. Repeated runs restore
the defined demo names, time zone, durations, business links, and active flags.
Specialist names and active flags are restored too. Assignments are upserted by
the composite key (businessId, specialistId, serviceId); existing assignments have
an empty update payload, preserving their creation timestamps. Missing required
assignments are recreated. Additional manual assignments are retained.
Creation timestamps of existing records are preserved. Only those fixed demo IDs are updated; other
records are not removed or modified. Run this against a development database;
manual edits to these demo records are deliberately overwritten on the next run.
The script does not prune records removed from its dataset definition.

All upserts share one Prisma transaction, ordered business, services, specialists,
then assignments. A failure at any stage rolls back that run's changes. Apply all
migrations before seeding.
Logs omit driver error details and row values. Schema defaults still generate IDs
for normal inserts; fixed seed IDs require no migration. Schedules, bookings, and contact data are not seeded; their models do not exist yet.

Integration tests verify repeatability, preservation of unrelated records and
creation times, restoration of missing assignments, preservation of additional assignments, and
rollback when a service or later assignment insert fails. Tests use isolated
temporary schemas and never seed the application tables.

## Express application and HTTP server

- `src/app.ts` exports `createApp(database)`, which creates an Express application
  using the supplied Prisma Client. It registers JSON parsing, routes, and fallback
  handlers. Importing it does not construct a database client or open a network port.
  Tests supply a Prisma Client connected to an isolated schema.
- `src/main.ts` is the process entry point. It calls `createApp(prisma)` and
  passes the resulting application to `createServer`. It verifies the database connection before calling
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

## Public service catalogue

`GET /api/businesses/:businessId/services` lists active services for a business.
This is a public customer-facing catalogue endpoint; it grants no management access.
Future administrative endpoints must enforce authentication and business authorization.

From PowerShell with the backend running and demo data seeded:

```powershell
Invoke-RestMethod http://localhost:4000/api/businesses/10000000-0000-4000-8000-000000000001/services | ConvertTo-Json -Depth 4
```

The JSON envelope is `{ "services": [...] }`. Each entry contains only `id`,
`name`, and `durationMinutes`. Services are ordered by database name ascending,
then UUID ascending for ties. Demo data returns Beard trim (15 minutes), then
Haircut (30 minutes); inactive Hair coloring is excluded. Query parameters do
not enable inactive records. There is no pagination in this initial endpoint.

| Result                                     | HTTP status | Body                               |
| ------------------------------------------ | ----------- | ---------------------------------- |
| Business has active services               | 200         | `{ "services": [...] }`            |
| Business exists but has no active services | 200         | `{ "services": [] }`               |
| Noncanonical/malformed UUID                | 400         | Error code `INVALID_BUSINESS_ID`   |
| Valid UUID, business does not exist        | 404         | Error code `BUSINESS_NOT_FOUND`    |
| Unexpected query failure                   | 500         | Error code `INTERNAL_SERVER_ERROR` |

Canonical UUIDs contain five hexadecimal groups (8-4-4-4-12); either case is
accepted without limiting UUID versions. Runtime validation occurs before the
query: a TypeScript string alone cannot validate an HTTP parameter.

`src/services/services.routes.ts` handles HTTP validation and status codes.
`src/services/services.repository.ts` performs the Prisma lookup and selects only
public fields from active services belonging to the specified business. It returns
null for a missing business and an array (possibly empty) for an existing one.
Express 5 forwards rejected async handlers to the final error middleware.
The endpoint does not change bookings, availability, or any database rows.

Integration tests use a temporary schema and real HTTP requests to check filtering,
business scoping, stable ordering, empty lists, UUID validation, missing businesses,
and generic error responses/logs after a real database query failure.

## Public specialists for a service

`GET /api/businesses/:businessId/services/:serviceId/specialists` returns
`{ "specialists": [{ "id": "...", "name": "..." }] }`.
Only active specialists assigned to the requested active service within the
requested business are included. Results are ordered by specialist name ascending,
then UUID ascending for ties. Query parameters cannot enable inactive records.
There is no pagination in this initial endpoint.

| Result                                             | HTTP status | Error code or body         |
| -------------------------------------------------- | ----------- | -------------------------- |
| Active service with matching specialists           | 200         | `{ "specialists": [...] }` |
| Active service with no active assigned specialists | 200         | `{ "specialists": [] }`    |
| Malformed business UUID                            | 400         | `INVALID_BUSINESS_ID`      |
| Malformed service UUID                             | 400         | `INVALID_SERVICE_ID`       |
| Missing business                                   | 404         | `BUSINESS_NOT_FOUND`       |
| Missing, inactive, or other-business service       | 404         | `SERVICE_NOT_FOUND`        |
| Unexpected query failure                           | 500         | `INTERNAL_SERVER_ERROR`    |

Both UUIDs are validated before database access, business UUID first. Validation
accepts the same canonical format as the services endpoint, including uppercase.
After validation, a missing business takes precedence over a missing service.
Errors use the existing `{ "error": { "code": "...", "message": "..." } }` format.

For the seeded Haircut service:

```powershell
Invoke-RestMethod http://localhost:4000/api/businesses/10000000-0000-4000-8000-000000000001/services/20000000-0000-4000-8000-000000000001/specialists | ConvertTo-Json -Depth 4
```

The seed defines Alex and Alice for Haircut, in that response order, and Alice
for Beard trim. These assignments describe who provides a service; they do not
establish working hours or available appointment times. This public read endpoint
grants no management access and changes no database rows.

`src/specialists/specialists.repository.ts` queries the business and its matching
active service, then filters assignments by active specialist and selects public
fields. Its tagged result distinguishes a missing business, a missing service,
and a successful list. `src/specialists/specialists.routes.ts` maps those outcomes
to HTTP responses. Both catalogue routes use `src/validation/uuid.ts`.

Repository outcomes use the feature-local `ServiceSpecialistsStatus` enum in
`src/specialists/specialists.types.ts`. Public error codes use `ApiErrorCode` in
`src/http/api-error-code.ts` across routes and fallback middleware. Their string
values preserve the JSON contract. Repository outcomes carry no HTTP status codes;
routes remain responsible for mapping them to HTTP responses.

Real HTTP/database integration tests use an isolated schema to cover scoping,
assignments, active flags, deactivation, public fields, ordering, empty results,
UUID validation, missing resources, and generic database failures.

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
default; standalone primitives are rejected. Unexpected request failures produce a generic log message and response, without
Prisma/driver details, SQL parameters, or stack traces that may contain row values. If a response
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
use temporary schemas to run the real Prisma CLI and verify deployment, baselining,
and table constraints without changing application tables. A role with CREATE SCHEMA
permission is required. Interrupted tests may leave a bookify*test*\* schema behind.

Server integration tests also start a child process to verify the health endpoint,
Prisma startup failure, HTTP port conflicts, and graceful resource cleanup. On
Windows, OS SIGTERM forcibly terminates a process, so a test-only IPC fixture emits
the signal event to exercise the same application handler portably. This does not
verify OS signal delivery on every platform. Production code has no test IPC API.
