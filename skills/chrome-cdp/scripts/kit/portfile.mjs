import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const PORT_FILE_NAME = 'DevToolsActivePort';

const WINDOWS_BROWSERS = ['Google/Chrome', 'Google/Chrome Beta', 'Chromium', 'BraveSoftware/Brave-Browser', 'Microsoft/Edge', 'Vivaldi'];
const MAC_BROWSERS = ['Google/Chrome', 'Google/Chrome Beta', 'Chromium', 'BraveSoftware/Brave-Browser', 'Microsoft Edge', 'Vivaldi'];
const LINUX_BROWSERS = ['google-chrome', 'google-chrome-beta', 'chromium', 'BraveSoftware/Brave-Browser', 'microsoft-edge', 'vivaldi'];

/**
 * Every place a Chromium browser may have written DevToolsActivePort.
 * `CDP_PORT_FILE` always wins so callers can pin one browser explicitly.
 */
export function candidatePortFiles(env = process.env, plat = process.platform) {
  const files = [];
  if (env.CDP_PORT_FILE) files.push(env.CDP_PORT_FILE);
  const home = homedir();
  if (plat === 'win32') {
    const base = env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    for (const browser of WINDOWS_BROWSERS) files.push(join(base, browser, 'User Data', PORT_FILE_NAME));
  } else if (plat === 'darwin') {
    for (const browser of MAC_BROWSERS) files.push(join(home, 'Library', 'Application Support', browser, PORT_FILE_NAME));
  } else {
    const config = env.XDG_CONFIG_HOME || join(home, '.config');
    for (const browser of LINUX_BROWSERS) files.push(join(config, browser, PORT_FILE_NAME));
  }
  return [...new Set(files.filter(Boolean))];
}

export function parsePortFile(text) {
  const lines = String(text).trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0]?.trim() || !lines[1]?.trim()) {
    throw new Error('invalid DevToolsActivePort (expected "<port>\\n<browser path>")');
  }
  const port = Number(lines[0].trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid port in DevToolsActivePort: ${lines[0]}`);
  const path = lines[1].trim();
  if (!path.startsWith('/')) throw new Error(`invalid websocket path in DevToolsActivePort: ${path}`);
  return { port, path };
}

export function readPortFile(file) {
  return parsePortFile(readFileSync(file, 'utf8'));
}

export function wsUrlFor({ port, path }, host = '127.0.0.1') {
  return `ws://${host}:${port}${path}`;
}

export function portFileToWs(file, host = '127.0.0.1') {
  return wsUrlFor(readPortFile(file), host);
}

/** Picks the existing port file with the newest mtime; returns null when none exist. */
export function pickNewestPortFile(entries) {
  const present = entries.filter((entry) => entry && entry.exists);
  present.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0));
  return present[0]?.file ?? null;
}

export function findPortFile(env = process.env, plat = process.platform) {
  const entries = candidatePortFiles(env, plat).map((file) => {
    try {
      const stat = statSync(file);
      return { file, exists: true, mtimeMs: stat.mtimeMs };
    } catch {
      return { file, exists: false, mtimeMs: 0 };
    }
  });
  return pickNewestPortFile(entries);
}

export async function waitForPortFile(file, { timeoutMs = 20_000, intervalMs = 100, sinceMs = 0 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const stat = statSync(file);
      if (stat.mtimeMs >= sinceMs) {
        const info = parsePortFile(readFileSync(file, 'utf8'));
        if (info.port) return file;
      }
    } catch {
      // Not written yet, or still empty.
    }
    await delay(intervalMs);
  }
  throw new Error(`timed out waiting for ${file}`);
}

export function describePortFiles(env = process.env, plat = process.platform) {
  return candidatePortFiles(env, plat).map((file) => {
    try {
      const stat = statSync(file);
      return { file, exists: true, mtime: new Date(stat.mtimeMs).toISOString() };
    } catch {
      return { file, exists: existsSync(file) };
    }
  });
}