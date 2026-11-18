import { parseArgs } from 'node:util';

export const OPTION_SPEC = {
  out: { type: 'string' },
  auth: { type: 'string' },
  profile: { type: 'string' },
  'source-profile': { type: 'string' },
  'port-file': { type: 'string' },
  browser: { type: 'string' },
  origin: { type: 'string', multiple: true },
  domain: { type: 'string', multiple: true },
  url: { type: 'string' },
  timeout: { type: 'string' },
  json: { type: 'boolean' },
  headless: { type: 'boolean' },
  'close-after-import': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

/** Parses kit options and returns any positionals for the caller to validate. */
export function parseOptions(argv) {
  const parsed = parseArgs({ args: argv, options: OPTION_SPEC, allowPositionals: true, strict: true });
  return { values: parsed.values, positionals: parsed.positionals };
}

export function parseOrigins(values = []) {
  const out = [];
  for (const value of values) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`--origin must be an absolute URL: ${value}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`--origin must be http(s): ${value}`);
    }
    out.push(url.origin);
  }
  return [...new Set(out)];
}

export function parseDomains(values = []) {
  return [...new Set(values.map((value) => String(value).trim().toLowerCase().replace(/^\./u, '')).filter(Boolean))];
}

export function parseTimeout(value, fallback = 15_000) {
  if (value === undefined) return fallback;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120_000) {
    throw new Error('--timeout must be an integer between 1000 and 120000 (ms)');
  }
  return timeout;
}