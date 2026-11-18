import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  daemonPortFile,
  daemonSocket,
  formatDaemonEndpoint,
  parseDaemonEndpoint,
  tcpDaemonEnabled,
} from '../skills/chrome-cdp/scripts/kit/ipc.mjs';
import { launchArgs } from '../skills/chrome-cdp/scripts/kit/launch.mjs';

const CLI = fileURLToPath(new URL('../skills/chrome-cdp/scripts/cdp.mjs', import.meta.url));

// --- upstream #19: daemon IPC transport ------------------------------------

test('daemon socket addressing is platform-aware', () => {
  assert.equal(daemonSocket('/run/cdp', 'abc', false), resolve('/run/cdp', 'cdp-abc.sock'));
  assert.equal(daemonSocket('C:/ignored', 'abc', true), '\\\\.\\pipe\\cdp-abc');
});

test('TCP daemon mode is opt-in through CDP_DAEMON_TCP', () => {
  assert.equal(tcpDaemonEnabled({}), false);
  assert.equal(tcpDaemonEnabled({ CDP_DAEMON_TCP: '' }), false);
  assert.equal(tcpDaemonEnabled({ CDP_DAEMON_TCP: '0' }), false);
  assert.equal(tcpDaemonEnabled({ CDP_DAEMON_TCP: '1' }), true);
  assert.equal(tcpDaemonEnabled({ CDP_DAEMON_TCP: 'TRUE' }), true);
});

test('daemon port files round-trip the port and token', () => {
  const endpoint = { port: 51023, token: '2f6c1d2e-token' };
  const text = formatDaemonEndpoint(endpoint);
  assert.equal(text, '51023\n2f6c1d2e-token\n');
  assert.deepEqual(parseDaemonEndpoint(text), endpoint);
  assert.ok(daemonPortFile('/run/cdp', 'abc').endsWith('cdp-abc.port'));
});

test('malformed daemon endpoint files are rejected', () => {
  assert.throws(() => parseDaemonEndpoint('51023'), /token missing/);
  assert.throws(() => parseDaemonEndpoint('0\ntok'), /invalid daemon port/);
  assert.throws(() => parseDaemonEndpoint('70000\ntok'), /invalid daemon port/);
  assert.throws(() => parseDaemonEndpoint('nope\ntok'), /invalid daemon port/);
  assert.throws(() => formatDaemonEndpoint({ port: 70000, token: 't' }), /invalid daemon port/);
  assert.throws(() => formatDaemonEndpoint({ port: 5000 }), /token required/);
});

// --- upstream #40: Chromium 128+ origin allowlist --------------------------

test('self-launched browsers allowlist the CDP origin', () => {
  const args = launchArgs({ profile: '/tmp/profile' });
  assert.ok(args.includes('--user-data-dir=/tmp/profile'));
  assert.ok(args.includes('--remote-debugging-port=0'));
  assert.ok(args.includes('--remote-allow-origins=*'));
  assert.equal(args.at(-1), 'about:blank');
  assert.ok(!args.includes('--headless=new'));
  assert.ok(launchArgs({ profile: '/p', headless: true }).includes('--headless=new'));
  assert.equal(launchArgs({ profile: '/p', url: 'https://x.test' }).at(-1), 'https://x.test');
});

// --- upstream #24: canvas drag --------------------------------------------

test('help documents drag and keeps exit code zero', () => {
  const help = execFileSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' });
  assert.match(help, /drag\s+<target> <x1> <y1> <x2> <y2>/);
  assert.match(help, /type, loadall, drag, evalraw, stop/);
});

test('drag without a target fails before touching a browser', () => {
  assert.throws(
    () => execFileSync(process.execPath, [CLI, 'drag'], { encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.status === 1 && /target ID required/.test(String(error.stderr)),
  );
});

// A rejected upgrade that arrives as a bare close used to leave the connect
// promise unsettled: `cdp list` hung forever instead of reporting the cause.
test('a rejected handshake fails fast and names the allowlist flag', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/json/version') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"Browser":"Fake/1.0"}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.on('upgrade', (req, socket) => {
    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
    socket.destroy();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));

  const dir = mkdtempSync(join(tmpdir(), 'cdp-test-'));
  const portFile = join(dir, 'DevToolsActivePort');
  writeFileSync(portFile, `${server.address().port}\n/devtools/browser/fake-0000\n`);
  const started = Date.now();

  try {
    const result = await new Promise((done) => {
      const child = spawn(process.execPath, [CLI, 'list'], {
        env: { ...process.env, CDP_PORT_FILE: portFile },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      const kill = setTimeout(() => child.kill('SIGKILL'), 15_000);
      child.on('exit', (code) => {
        clearTimeout(kill);
        done({ code, stderr });
      });
    });

    assert.notEqual(result.code, 0, 'must not report success');
    assert.match(result.stderr, /remote-allow-origins/, 'must name the flag');
    assert.ok(Date.now() - started < 10_000, 'must not hang on the unresolved handshake');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});