# Bookify Frontend

Next.js 16 App Router, React 19, TypeScript, and CSS Modules. The home page renders
a public service catalogue from the Express API. Users can select a service through
the URL and view its active specialists. Specialist selection and booking are not
implemented yet.

## Local development

Use Node.js 24 or newer and pnpm (10.29.1 was used for the current lockfile).
Run commands from the repository root:

```sh
pnpm -C frontend install
pnpm -C frontend dev
```

First prepare and start the backend in a separate terminal:

```sh
docker compose up -d --wait postgres
pnpm -C backend db:generate
pnpm -C backend db:migrate
pnpm -C backend db:seed
pnpm -C backend dev
```

Open http://localhost:3000. Demo data displays Beard trim (15 minutes) and Haircut
(30 minutes). Inactive Hair coloring is excluded by the API.

## Server environment

The defaults work with the local seeded backend. Optionally copy .env.example to
.env.local in frontend (preserve any existing file), then change:

| Variable            | Default                              | Purpose                                                |
| ------------------- | ------------------------------------ | ------------------------------------------------------ |
| BACKEND_API_URL     | http://127.0.0.1:4000                | Backend origin reachable from the Next.js server       |
| BOOKIFY_BUSINESS_ID | 10000000-0000-4000-8000-000000000001 | Business whose active services appear on the home page |

Restart Next.js after changing environment configuration. These are server variables,
not NEXT_PUBLIC variables. The three environment files have separate consumers:
root .env for Compose, backend/.env for Express, frontend/.env.local for Next.js.
In deployment, use an API address reachable from the Next.js host; loopback is
only correct when both processes run on the same host/network namespace.

## Data flow and states

The browser requests the home page from Next.js. Its async Services Server
Component calls getBusinessServices in src/lib/services.ts, which fetches
GET /api/businesses/:businessId/services from Express. Express owns Prisma queries
and business rules; Next.js does not connect to PostgreSQL.

The data module delegates server environment validation to src/lib/config.ts and
response parsing/types to src/lib/services.schema.ts. Configuration is read inside
the request function, so invalid settings still produce the catalogue error state.
No generic HTTP client is introduced.

The server-only marker prevents importing the data module into a Client Component.
The API origin is not passed to browser code. This server-to-server request needs
no browser CORS configuration. No proxy route or client data-fetching library is used.

The component calls connection() inside Suspense to defer data loading until an
incoming request; production builds do not need the API running. Suspense renders
a loading message while the service list is pending. Fetch uses cache: no-store
and a five-second timeout. Reloading or submitting Try again performs a new request.

The response JSON is validated at runtime before rendering. TypeScript alone cannot
validate an external HTTP response. Empty lists, missing businesses, non-OK responses,
invalid payloads, configuration errors, and timeouts have explicit UI states. Failures
show a generic message without exposing backend diagnostics. Error states are page
content with HTTP 200; this initial catalogue does not translate backend status codes
into the document's HTTP status.

Layout metadata identifies Bookify. CSS Modules provide responsive catalogue styles;
the system font stack avoids external font downloads during builds.

## Specialist data loading

`src/lib/specialists.ts` provides the server-only `getServiceSpecialists(serviceId)`
loader for the configured business. It validates the service UUID before fetching
the public specialists endpoint, reuses the catalogue configuration, disables
caching, and applies a five-second timeout.

`src/lib/specialists.schema.ts` validates responses from unknown JSON and retains
only specialist IDs and names. Empty lists are successful results. Validated API
404 codes distinguish missing businesses from missing/inactive services; unexpected
404 bodies, invalid JSON, other HTTP errors, configuration errors and network failures
produce an unavailable result without logging response details.

Loader outcomes use the frontend-local `SpecialistsLoadStatus` enum in `src/enums`.
Backend modules are not imported into the frontend.

## Service selection

Service links navigate to `/?serviceId=<uuid>` using Next.js navigation. The URL is
the source of selection state, so reloads and browser back/forward retain the selection.
Links contain only the new service ID, dropping any previous specialist selection.
The selected service is highlighted visually and marked with `aria-current`.

The Services Server Component reads asynchronous page search parameters inside
Suspense. It validates a single canonical service UUID and checks that it belongs
to the current active catalogue before loading specialists. Repeated parameters,
empty/malformed UUIDs and missing/inactive services show explicit selection states.
Uppercase UUIDs are accepted. Clear selection returns to `/`.

`src/app/specialists.tsx` loads and displays specialists in a nested Suspense boundary
keyed by service ID. Loading, empty, missing-business, unavailable-service and failure
states are handled. The retry GET form retains the selected service ID. No browser
fetch to Express or global client state is introduced. Selecting a specialist and
viewing appointment availability remain future steps.

## Verification

```sh
pnpm -C frontend lint
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend build
```

Run pnpm -C frontend start after building to test the production server. If pnpm is
unavailable or Corepack selects a different major, run corepack pnpm@10.29.1 with
the same arguments from this directory.

No frontend test script or browser automation framework is configured. The initial
integration was checked against production HTML using the real seeded API, plus a
local HTTP fixture for empty, missing, malformed, failed, and timed-out responses,
and recovery on the next request. Visual browser checks remain manual.
