# Bookify Backend

API for booking appointments with service providers. Built with Express 5,
TypeScript, and ESM.

## Getting started

Run these commands from the repository root:

```sh
pnpm -C backend install
pnpm -C backend dev
```

The server listens on port `4000`. Automatic restarts on file changes are not
configured yet.

## Express application and HTTP server

- `src/app.ts` creates and exports the Express application, `app`. It defines
  request handling and will register middleware, routes, and error handlers as
  they are added. Importing this module does not open a network port.
- `src/main.ts` is the process entry point. It imports `app` and calls
  `app.listen(4000)`, which creates a Node.js HTTP server and starts accepting
  network requests.

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
