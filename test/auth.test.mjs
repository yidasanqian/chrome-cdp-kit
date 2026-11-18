import assert from 'node:assert/strict';
import test from 'node:test';
import { exportAuth, importAuth } from '../skills/chrome-cdp/scripts/kit/auth.mjs';

function fakeBrowser({ cookies = [], storage = {}, failNavigate = [] } = {}) {
  const calls = [];
  let currentUrl = 'about:blank';

  const send = async (method, params = {}, sessionId) => {
    calls.push({ method, params, sessionId });
    if (method === 'Target.createTarget') return { targetId: 'tab-1' };
    if (method === 'Target.attachToTarget') return { sessionId: 'session-1' };
    if (method === 'Storage.getCookies') return { cookies };
    if (method === 'Storage.setCookies') return {};
    if (method === 'Target.closeTarget') return {};
    if (method === 'Page.navigate') {
      if (failNavigate.includes(params.url)) throw new Error(`navigation blocked: ${params.url}`);
      currentUrl = params.url;
      return {};
    }
    if (method === 'Runtime.evaluate') {
      const expression = params.expression;
      if (expression === 'document.readyState') return { result: { value: 'complete' } };
      if (expression === 'location.origin') return { result: { value: new URL(currentUrl).origin } };
      if (expression.startsWith('JSON.stringify(Object.fromEntries')) {
        return { result: { value: JSON.stringify(storage[new URL(currentUrl).origin] ?? {}) } };
      }
      if (expression.startsWith('(() => { const data')) {
        const match = /const data = (.+?); for \(const key/s.exec(expression);
        assert.ok(match, 'localStorage write expression should embed the data');
        const data = JSON.parse(match[1]);
        const origin = new URL(currentUrl).origin;
        storage[origin] = { ...(storage[origin] ?? {}), ...data };
        return { result: { value: true } };
      }
      throw new Error(`unexpected expression: ${expression}`);
    }
    throw new Error(`unexpected method: ${method}`);
  };
  return { send, calls, storage };
}

test('export reads cookies and per-origin localStorage from one temporary tab', async () => {
  const browser = fakeBrowser({
    cookies: [
      { name: 'sid', value: 'v', domain: '.example.com', path: '/', expires: 1_900_000_000, size: 42, httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'other', value: 'x', domain: '.other.test', path: '/', expires: -1 },
    ],
    storage: { 'https://example.com': { token: 'abc' } },
  });

  const auth = await exportAuth({ send: browser.send, origins: ['https://example.com'], domains: ['example.com'] });

  assert.equal(auth.version, 1);
  assert.deepEqual(auth.cookies.map((cookie) => cookie.name), ['sid']);
  assert.equal(auth.cookies[0].size, undefined);
  assert.deepEqual(auth.localStorage, { 'https://example.com': { token: 'abc' } });
  assert.ok(browser.calls.some((call) => call.method === 'Target.closeTarget'));
  assert.equal(browser.calls.filter((call) => call.method === 'Target.createTarget').length, 1);
});

test('export records navigation failures and continues', async () => {
  const browser = fakeBrowser({ failNavigate: ['https://broken.test'] });
  const auth = await exportAuth({ send: browser.send, origins: ['https://broken.test', 'https://example.com'] });
  assert.equal(auth.errors?.length, 1);
  assert.equal(auth.errors[0].origin, 'https://broken.test');
  assert.deepEqual(auth.localStorage, { 'https://example.com': {} });
});

test('import sets cookies in batches and writes localStorage', async () => {
  const cookies = Array.from({ length: 250 }, (_, index) => ({
    name: `c${index}`,
    value: String(index),
    domain: '.example.com',
    path: '/',
    expires: 1_900_000_000,
    ...(index === 0 ? { partitionKey: { topLevelSite: 'https://example.com', hasCrossSiteAncestor: false } } : {}),
  }));
  const browser = fakeBrowser();
  const result = await importAuth({
    send: browser.send,
    auth: { version: 1, cookies, localStorage: { 'https://example.com': { token: 'xyz' } } },
  });

  assert.equal(result.cookies, 250);
  assert.deepEqual(result.origins, ['https://example.com']);
  const batches = browser.calls.filter((call) => call.method === 'Storage.setCookies');
  assert.deepEqual(batches.map((call) => call.params.cookies.length), [100, 100, 50]);
  assert.deepEqual(batches[0].params.cookies[0].partitionKey, {
    topLevelSite: 'https://example.com',
    hasCrossSiteAncestor: false,
  });
  assert.equal(browser.storage['https://example.com'].token, 'xyz');
});

test('import rejects unknown payload versions', async () => {
  const browser = fakeBrowser();
  await assert.rejects(() => importAuth({ send: browser.send, auth: { version: 2 } }), /unsupported auth payload/);
  assert.equal(browser.calls.length, 0);
});