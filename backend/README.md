# Bookify Backend

API for booking appointments with service providers. Built with Express 5,
TypeScript, and ESM.

## Getting started

Use Node.js 24 or newer and pnpm.

Run these commands from the repository root:

```sh
pnpm -C backend install
pnpm -C backend dev
```

The server defaults to port `4000`. Automatic restarts on file changes are not
configured yet. If pnpm is not available directly, run `corepack pnpm` instead.

## Environment configuration

Optionally copy `backend/.env.example` to `backend/.env` and change `PORT`.
From the repository root in PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

The development command uses Node.js's `--env-file-if-exists=.env` flag to load
the file before application modules run. The path is relative to the backend
working directory. The file is optional; a missing file does not prevent startup.
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

## Express application and HTTP server

- `src/app.ts` creates and exports the Express application, `app`. It defines
  request handling and will register middleware, routes, and error handlers as
  they are added. Importing this module does not open a network port.
- `src/main.ts` is the process entry point. It imports `app` and calls
  `app.listen(config.port)`, which creates a Node.js HTTP server and starts
  accepting network requests. `src/config.ts` reads and validates the port.

Request flow:

```text
Client → HTTP server → Express application → Route handler → Response to client
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

## Verification

```sh
pnpm -C backend lint
pnpm -C backend exec tsc --noEmit
```

After starting the server, send `GET http://localhost:4000/api/health`, for example
using PowerShell:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Expect HTTP `200` with JSON `{ "ok": true }`.
This endpoint checks that the server responds; no database is connected yet.
The `test` script is currently a placeholder that exits with an error.
