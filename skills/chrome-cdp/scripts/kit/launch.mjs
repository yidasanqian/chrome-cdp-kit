import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findBrowserExecutable } from './browsers.mjs';
import { portFileToWs, waitForPortFile } from './portfile.mjs';

/**
 * Chromium 128+ enforces a WebSocket Origin allowlist that the inspect toggle
 * does not populate (upstream #40); a self-launched browser must set the flag.
 */
export function launchArgs({ profile, url = 'about:blank', headless = false }) {
  return [
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    ...(headless ? ['--headless=new'] : []),
    url,
  ];
}

/**
 * Starts a browser on its own profile with an ephemeral debugging port.
 * The process is detached: it keeps running after this CLI exits.
 */
export async function launchBrowser({
  browser = 'auto',
  profile,
  url = 'about:blank',
  headless = false,
  timeoutMs = 20_000,
} = {}) {
  if (!profile) throw new Error('--profile is required');
  const executable = findBrowserExecutable(browser);
  if (!executable) throw new Error(`no browser executable found for "${browser}"`);
  mkdirSync(profile, { recursive: true });

  const portFile = join(profile, 'DevToolsActivePort');
  const startedAt = Date.now();
  const args = launchArgs({ profile, url, headless });

  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();

  try {
    const file = await waitForPortFile(portFile, { timeoutMs, sinceMs: startedAt - 500 });
    return { executable, profile, portFile: file, wsUrl: portFileToWs(file), pid: child.pid };
  } catch (error) {
    throw new Error(
      `${error.message}; the profile may already be in use, or the browser refused remote debugging`,
    );
  }
}