import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseDomains, parseOptions, parseOrigins, parseTimeout } from '../skills/chrome-cdp/scripts/kit/args.mjs';
import { chunk, filterCookies, toCookieParams } from '../skills/chrome-cdp/scripts/kit/auth.mjs';
import { browserExecutableCandidates } from '../skills/chrome-cdp/scripts/kit/browsers.mjs';
import { handles } from '../skills/chrome-cdp/scripts/kit/cli.mjs';
import { candidatePortFiles, parsePortFile, pickNewestPortFile, wsUrlFor } from '../skills/chrome-cdp/scripts/kit/portfile.mjs';

const CLI = fileURLToPath(new URL('../skills/chrome-cdp/scripts/cdp.mjs', import.meta.url));

test('DevToolsActivePort parsing accepts the two-line format', () => {
  assert.deepEqual(parsePortFile('9222\n/devtools/browser/abc-123\n'), { port: 9222, path: '/devtools/browser/abc-123' });
  assert.deepEqual(parsePortFile('9222\r\n/devtools/browser/x\r\n'), { port: 9222, path: '/devtools/browser/x' });
  assert.equal(wsUrlFor({ port: 9222, path: '/devtools/browser/x' }), 'ws://127.0.0.1:9222/devtools/browser/x');
});

test('DevToolsActivePort parsing rejects malformed files', () => {
  assert.throws(() => parsePortFile('9222'), /invalid DevToolsActivePort/);
  assert.throws(() => parsePortFile('abc\n/devtools/browser/x'), /invalid port/);
  assert.throws(() => parsePortFile('9222\nnope'), /invalid websocket path/);
});

test('CDP_PORT_FILE wins and the newest existing port file is selected', () => {
  const files = candidatePortFiles({ CDP_PORT_FILE: 'C:/pinned/DevToolsActivePort' }, 'win32');
  assert.equal(files[0], 'C:/pinned/DevToolsActivePort');
  assert.ok(files.length > 1);

  const picked = pickNewestPortFile([
    { file: 'old', exists: true, mtimeMs: 10 },
    { file: 'new', exists: true, mtimeMs: 20 },
    { file: 'gone', exists: false, mtimeMs: 30 },
  ]);
  assert.equal(picked, 'new');
  assert.equal(pickNewestPortFile([{ file: 'gone', exists: false }]), null);
});

test('cookie filtering is a domain suffix match, not a substring match', () => {
  const cookies = [
    { name: 'a', domain: '.example.com' },
    { name: 'b', domain: 'sub.example.com' },
    { name: 'c', domain: 'badexample.com' },
    { name: 'd', domain: '.other.test' },
  ];
  assert.deepEqual(
    filterCookies(cookies, ['example.com']).map((cookie) => cookie.name),
    ['a', 'b'],
  );
  assert.equal(filterCookies(cookies, []).length, 4);
});

test('cookie export keeps what setCookies needs, including partitionKey', () => {
  const [cookie] = toCookieParams([
    {
      name: 'sid',
      value: 'v',
      domain: '.example.com',
      path: '/',
      expires: 1_900_000_000,
      size: 42,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      session: false,
      priority: 'Medium',
      partitionKey: { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false },
    },
  ]);
  assert.equal(cookie.size, undefined);
  assert.equal(cookie.session, undefined);
  assert.equal(cookie.priority, undefined);
  assert.deepEqual(cookie.partitionKey, { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false });
  assert.equal(cookie.httpOnly, true);
});

test('chunk splits cookie batches', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
});

test('kit options normalize origins, domains and timeouts', () => {
  const { values } = parseOptions([
    '--out',
    'auth.json',
    '--origin',
    'https://example.com/some/path',
    '--origin',
    'https://example.com',
    '--domain',
    '.Example.COM',
    '--json',
  ]);
  assert.equal(values.out, 'auth.json');
  assert.equal(values.json, true);
  assert.deepEqual(parseOrigins(values.origin), ['https://example.com']);
  assert.deepEqual(parseDomains(values.domain), ['example.com']);
  assert.throws(() => parseOrigins(['ftp://example.com']), /http\(s\)/);
  assert.throws(() => parseOrigins(['not a url']), /absolute URL/);
  assert.equal(parseTimeout(undefined), 15_000);
  assert.throws(() => parseTimeout('10'), /between 1000 and 120000/);
  assert.throws(() => parseOptions(['--nope']), /Unknown option/);
});

test('browser discovery is platform-aware', () => {
  const edge = browserExecutableCandidates('edge', { ProgramFiles: 'C:/PF', 'ProgramFiles(x86)': 'C:/PF86', LOCALAPPDATA: 'C:/LA' }, 'win32');
  assert.ok(edge.length >= 2);
  assert.ok(edge.every((path) => path.endsWith('msedge.exe')));

  const auto = browserExecutableCandidates('auto', { ProgramFiles: 'C:/PF', 'ProgramFiles(x86)': 'C:/PF86', LOCALAPPDATA: 'C:/LA' }, 'win32');
  assert.ok(auto.some((path) => path.endsWith('chrome.exe')));
  assert.ok(auto.some((path) => path.endsWith('msedge.exe')));

  assert.deepEqual(browserExecutableCandidates('C:/custom/browser.exe', {}, 'win32'), ['C:/custom/browser.exe']);
});

test('kit dispatch covers only its own commands', () => {
  assert.equal(handles('auth'), true);
  assert.equal(handles('launch'), true);
  assert.equal(handles('doctor'), true);
  assert.equal(handles('list'), false);
  assert.equal(handles('eval'), false);
});

test('upstream CLI lists the kit commands and still exits zero', () => {
  const help = execFileSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' });
  assert.match(help, /auth export/);
  assert.match(help, /launch --profile/);
  assert.match(help, /doctor/);
  assert.match(help, /List open pages/);
});