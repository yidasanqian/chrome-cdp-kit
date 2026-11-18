import { setTimeout as delay } from 'node:timers/promises';

export const AUTH_VERSION = 1;

const COOKIE_FIELDS = ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite', 'partitionKey'];

/** Drops CDP-only fields (size, session, priority, source*) and keeps what setCookies needs. */
export function toCookieParams(cookies) {
  return (cookies ?? []).map((cookie) => {
    const out = {};
    for (const field of COOKIE_FIELDS) {
      if (cookie[field] !== undefined) out[field] = cookie[field];
    }
    return out;
  });
}

/** Suffix match on the registrable domain, not a plain substring match. */
export function filterCookies(cookies, domains = []) {
  if (!domains || domains.length === 0) return cookies;
  const wanted = domains.map((domain) => String(domain).toLowerCase().replace(/^\./u, ''));
  return cookies.filter((cookie) => {
    const domain = String(cookie.domain ?? '').toLowerCase().replace(/^\./u, '');
    return wanted.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
  });
}

export function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

async function evaluate(send, sessionId, expression) {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (reply.exceptionDetails) {
    const detail =
      reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text ?? 'Runtime.evaluate failed';
    throw new Error(detail);
  }
  return reply.result?.value;
}

async function waitForReady(send, sessionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evaluate(send, sessionId, 'document.readyState');
    if (state === 'complete') return;
    await delay(100);
  }
  throw new Error('page load timeout');
}

async function openBlankTab(send) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', background: true });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  return { targetId, sessionId };
}

async function closeTab(send, targetId) {
  await send('Target.closeTarget', { targetId }).catch(() => {});
}

async function readLocalStorage(send, sessionId) {
  const raw = await evaluate(send, sessionId, 'JSON.stringify(Object.fromEntries(Object.entries(localStorage)))');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalStorage(send, sessionId, entries) {
  const payload = JSON.stringify(entries ?? {});
  await evaluate(
    send,
    sessionId,
    `(() => { const data = ${payload}; for (const key of Object.keys(data)) localStorage.setItem(key, data[key]); return true; })()`,
  );
}

/**
 * Reads cookies and the localStorage of `origins` from the browser behind
 * `send`. One connection, one temporary background tab, no user tab touched.
 */
export async function exportAuth({ send, origins = [], domains = [], timeoutMs = 15_000 }) {
  const { targetId, sessionId } = await openBlankTab(send);
  const errors = [];
  try {
    const { cookies } = await send('Storage.getCookies', {}, sessionId);
    const localStorage = {};
    for (const origin of origins) {
      try {
        await send('Page.navigate', { url: origin }, sessionId);
        await waitForReady(send, sessionId, timeoutMs);
        const actual = await evaluate(send, sessionId, 'location.origin');
        if (!actual || actual === 'null') throw new Error('navigation did not reach the origin');
        localStorage[actual] = await readLocalStorage(send, sessionId);
      } catch (error) {
        errors.push({ origin, message: error.message });
      }
    }
    return {
      version: AUTH_VERSION,
      exportedAt: Date.now(),
      cookies: filterCookies(toCookieParams(cookies), domains),
      localStorage,
      ...(errors.length > 0 ? { errors } : {}),
    };
  } finally {
    await closeTab(send, targetId);
  }
}

/**
 * Writes an auth payload into the browser behind `send`. Cookies are set first,
 * then each origin's localStorage is written from a temporary background tab.
 */
export async function importAuth({ send, auth, origins = [], timeoutMs = 15_000 }) {
  if (!auth || auth.version !== AUTH_VERSION) throw new Error(`unsupported auth payload (expected version ${AUTH_VERSION})`);
  const { targetId, sessionId } = await openBlankTab(send);
  const errors = [];
  let cookies = 0;
  try {
    for (const batch of chunk(auth.cookies ?? [], 100)) {
      await send('Storage.setCookies', { cookies: batch }, sessionId);
      cookies += batch.length;
    }
    const wanted = origins.length > 0 ? origins : Object.keys(auth.localStorage ?? {});
    const written = [];
    for (const origin of wanted) {
      const entries = auth.localStorage?.[origin];
      if (!entries || typeof entries !== 'object' || Object.keys(entries).length === 0) continue;
      try {
        await send('Page.navigate', { url: origin }, sessionId);
        await waitForReady(send, sessionId, timeoutMs);
        const actual = await evaluate(send, sessionId, 'location.origin');
        if (!actual || actual === 'null') throw new Error('navigation did not reach an http(s) origin');
        await writeLocalStorage(send, sessionId, entries);
        await delay(150);
        written.push(origin);
      } catch (error) {
        errors.push({ origin, message: error.message });
      }
    }
    return { cookies, origins: written, ...(errors.length > 0 ? { errors } : {}) };
  } finally {
    await closeTab(send, targetId);
  }
}