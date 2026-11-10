import process from 'node:process';

// Windows terminates a process on OS SIGTERM. IPC exercises our actual signal
// handler portably, without adding test controls to the application entry point.
process.on('message', (message) => {
  if (message === 'shutdown') {
    process.emit('SIGTERM');
    process.disconnect();
  }
});

await import('../../src/main.ts');
if (process.exitCode) {
  process.disconnect();
} else {
  process.send('ready');
}
