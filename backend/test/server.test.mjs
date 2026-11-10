import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

async function reservePort() {
  const server = createServer();
  server.listen(0);
  await once(server, 'listening');
  return { server, port: server.address().port };
}

async function unusedPort() {
  const { server, port } = await reservePort();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function startBackend(t, environment) {
  const child = fork(fileURLToPath(new URL('./fixtures/server-process.mjs', import.meta.url)), {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, ...environment },
    silent: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const exited = once(child, 'exit');
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  return { child, exited, output: () => output };
}

test(
  'startup queries through Prisma, health responds, and shutdown closes database resources',
  { timeout: 20000 },
  async (t) => {
    const port = await unusedPort();
    const backend = startBackend(t, { PORT: String(port) });
    await once(backend.child, 'message', { signal: globalThis.AbortSignal.timeout(15000) });
    const response = await globalThis.fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    backend.child.send('shutdown');
    const [code] = await backend.exited;
    assert.equal(code, 0);
    assert.match(backend.output(), /Database connection verified/);
    assert.match(backend.output(), /HTTP server and database pool closed/);
    assert.doesNotMatch(backend.output(), /Forcing process exit/);
  },
);

test('database connection failure exits before starting HTTP', { timeout: 15000 }, async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  url.hostname = '127.0.0.1';
  url.port = String(await unusedPort());
  const backend = startBackend(t, { PORT: String(await unusedPort()), DATABASE_URL: url.href });
  const [code] = await backend.exited;
  assert.equal(code, 1);
  assert.match(backend.output(), /Backend startup failed/);
  assert.match(backend.output(), /HTTP server and database pool closed/);
  assert.doesNotMatch(backend.output(), /Server started on port/);
  assert.ok(!backend.output().includes(url.href));
});

test(
  'HTTP listen failure closes the connected Prisma client and pool',
  { timeout: 15000 },
  async (t) => {
    const { server, port } = await reservePort();
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const backend = startBackend(t, { PORT: String(port) });
    const [code] = await backend.exited;
    assert.equal(code, 1);
    assert.match(backend.output(), /Database connection verified/);
    assert.match(backend.output(), /EADDRINUSE/);
    assert.match(backend.output(), /HTTP server and database pool closed/);
  },
);
