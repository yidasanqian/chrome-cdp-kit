import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { browserDaemonId } from '../skills/chrome-cdp/scripts/kit/ipc.mjs';

const CLI = fileURLToPath(new URL('../skills/chrome-cdp/scripts/cdp.mjs', import.meta.url));

// --- naming ----------------------------------------------------------------

test('the browser daemon id tracks the browser UUID, not the profile', () => {
  const a = browserDaemonId('ws://127.0.0.1:9222/devtools/browser/9ce8d049-d2d1-4af8-ba5e-0af601d4bb5e');
  assert.ok(a.startsWith('browser-9ce8d049-d2d1-4af8-ba5e-0af601d4'), a);
  assert.ok(a.length <= 40, 'keeps the socket path short');
  // Same browser, different port file location -> same daemon.
  assert.equal(a, browserDaemonId('ws://localhost:9333/devtools/browser/9ce8d049-d2d1-4af8-ba5e-0af601d4bb5e'));
  // Restart produces a new UUID -> a new daemon (and a new consent prompt).
  assert.notEqual(a, browserDaemonId('ws://127.0.0.1:9222/devtools/browser/1f0c1e55-0000-4000-8000-000000000000'));
  assert.equal(browserDaemonId(''), 'browser-default');
});

// --- one connection for many browser-level commands ------------------------

const TARGET = 'AAAABBBBCCCCDDDDEEEEFFFF00001111';

function encodeFrame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

// Minimal CDP endpoint: enough WebSocket framing for the CLI to talk to it, and
// a counter so the test can prove how many connections it took.
function createFakeBrowser() {
  const server = createServer((req, res) => {
    if (req.url === '/json/version') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"Browser":"Fake/1.0"}');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const state = { upgrades: 0, sockets: new Set() };

  server.on('upgrade', (req, socket) => {
    state.upgrades += 1;
    state.sockets.add(socket);
    socket.on('close', () => state.sockets.delete(socket));
    socket.on('error', () => {});
    const accept = createHash('sha1')
      .update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );

    let acc = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      acc = Buffer.concat([acc, chunk]);
      for (;;) {
        if (acc.length < 2) return;
        const opcode = acc[0] & 0x0f;
        const masked = (acc[1] & 0x80) !== 0;
        let len = acc[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (acc.length < 4) return;
          len = acc.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (acc.length < 10) return;
          len = Number(acc.readBigUInt64BE(2));
          off = 10;
        }
        const need = off + (masked ? 4 : 0) + len;
        if (acc.length < need) return;
        let data;
        if (masked) {
          const mask = acc.subarray(off, off + 4);
          off += 4;
          data = Buffer.from(acc.subarray(off, off + len));
          for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        } else {
          data = acc.subarray(off, off + len);
        }
        acc = acc.subarray(need);
        if (opcode === 0x8) { socket.end(); return; }
        if (opcode !== 0x1) continue;

        const msg = JSON.parse(data.toString());
        const reply = (result) => socket.write(encodeFrame(JSON.stringify({ id: msg.id, result })));
        if (msg.method === 'Target.getTargets') {
          reply({
            targetInfos: [
              { targetId: TARGET, type: 'page', title: 'Fake page', url: 'about:blank', attached: false },
            ],
          });
        } else if (msg.method === 'Target.createTarget') {
          reply({ targetId: TARGET + 'X' });
        } else {
          reply({});
        }
      }
    });
  });

  return { server, state };
}

function runCli(args, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CLI, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    const kill = setTimeout(() => child.kill('SIGKILL'), 20_000);
    child.on('exit', (code) => {
      clearTimeout(kill);
      done({ code, stdout, stderr });
    });
  });
}

test('list and open reuse one browser-level connection', async () => {
  const fake = createFakeBrowser();
  await new Promise((resolve) => fake.server.listen(0, '127.0.0.1', resolve));

  const dir = mkdtempSync(join(tmpdir(), 'cdp-browser-'));
  const portFile = join(dir, 'DevToolsActivePort');
  writeFileSync(portFile, `${fake.server.address().port}\n/devtools/browser/fake-browser-uuid\n`);
  const env = {
    ...process.env,
    CDP_PORT_FILE: portFile,
    // Keep the detached daemon out of the real runtime dir.
    ...(process.platform === 'win32' ? { LOCALAPPDATA: dir } : { XDG_RUNTIME_DIR: dir }),
  };

  try {
    const first = await runCli(['list'], env);
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /Fake page/);
    assert.equal(fake.state.upgrades, 1, 'first list connects once');

    const second = await runCli(['list'], env);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /Fake page/);
    assert.equal(fake.state.upgrades, 1, 'second list reuses the daemon connection');

    const opened = await runCli(['open', 'about:blank'], env);
    assert.equal(opened.code, 0, opened.stderr);
    assert.match(opened.stdout, /Opened new tab/);
    assert.equal(fake.state.upgrades, 1, 'open reuses the same connection');

    await runCli(['stop'], env);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(fake.state.sockets.size, 0, 'stop closes the browser daemon connection');
  } finally {
    for (const socket of fake.state.sockets) socket.destroy();
    fake.server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});