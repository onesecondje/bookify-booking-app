# Bookify Frontend

Next.js 16 App Router, React 19, TypeScript, and CSS Modules. The home page renders
a public service catalogue from the Express API. Users can select a service through
the URL, choose an active assigned specialist, select a date and slot, and confirm
an appointment.

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
response parsing to src/lib/services.schema.ts, with types in
src/lib/types/services.types.ts. Configuration is read inside
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
fetch to Express or global client state is introduced.

Specialist links add `specialistId` to the URL while retaining `serviceId`. A single
canonical specialist UUID must match an entry in the freshly loaded specialist list
before a summary is displayed. Repeated/malformed IDs and unavailable specialists
show explicit states. Uppercase UUIDs are accepted. A specialist ID without a service
does not produce a selection. Even a single specialist requires explicit selection.

The summary shows service, duration and specialist. Clearing the specialist retains
the service. Changing the service
clears the specialist, and retrying a failed load retains a well-formed specialist ID
for revalidation.

## Date and time selection

Once the selected specialist matches the active assignment, the date form adds a
`date=YYYY-MM-DD` query parameter. Its GET submission retains the service and
specialist IDs and clears the previous time. Changing the service or specialist
clears the date and time. A missing or invalid date does not call the availability API.

`src/app/appointment-selection.tsx` renders the date form and a Suspense boundary.
`src/app/availability-slots.tsx` loads schedule slots using the server-only
`getSpecialistAvailability` loader. Slot links add the UTC `startsAt`
to the URL. The server highlights a time only when the start matches a slot in the
fresh response. An expired or invalid selection can be replaced. Retrying a temporary
failure keeps the date and the single requested start for revalidation.

Times use the business time zone from the response. When two slots share the same
formatted time, their UTC offsets are also shown. The date is a calendar day in
the business time zone. Slots reflect the working schedule and active bookings.

## Booking confirmation

The contact form appears after a selected start matches a slot in the current
availability response. A Next.js Server Action sends the customer's name and
phone with the selected date and UTC start to Express. Known contact validation
errors are displayed beside the corresponding input, and entered values remain
available for correction. The button is disabled while the request
is pending. A validated `201` displays the date, local time and booking reference.
The receipt is held in form state for the current visit.

On `409`, the action redirects to the same service, specialist and date without the
stale start. The page reloads availability and prompts the user to select another
time. Other failures display a message asking the user to refresh availability
before trying again. Express validates the slot and PostgreSQL prevents a double
booking during the write.

## Business dashboard

Visit `/business` and sign in through the browser prompt as `business`.
Set `BOOKIFY_DASHBOARD_PASSWORD` to a separate random password with at least
32 characters in the Next.js server environment. Use HTTPS outside local
development. This pilot uses a shared business login.

Set `BOOKIFY_MANAGED_BUSINESS_ID` and `BOOKIFY_BUSINESS_BOOKINGS_TOKEN` on both
servers. Next.js uses the API token only for its server-to-server request to
Express. The dashboard shows upcoming bookings, customer contacts, and booking
status, with appointment times labeled in UTC. Dashboard responses are private
and are not cached.

Use **Cancel booking** on a confirmed booking and approve the prompt. The server
action checks dashboard access, calls the protected cancellation endpoint, and
refreshes the dashboard. The booking remains visible with status **Cancelled**.

In **Weekly schedule**, choose a specialist and select **Show schedule**. The
selection is stored in the `specialistId` URL parameter. Active specialists are
listed first, then inactive specialists, with each group ordered by name and ID.
The schedule uses the business time zone, lists separate intervals for split
shifts, and marks days without intervals as **Day off**. **Back to booking**
opens the public booking page.

Expand **Edit** for a weekday to replace its working hours. Enter one
`HH:MM-HH:MM` interval per line, or leave the field blank for a day off.
`24:00` is supported as an end time. The change affects recurring availability
for future booking requests and preserves existing appointments.

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
