import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NAMES = ['chrome', 'edge', 'chromium', 'brave', 'vivaldi'];

function windowsPaths(env) {
  const programFiles = env.ProgramFiles || 'C:/Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
  const local = env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  return {
    chrome: [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
    edge: [
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
    chromium: [join(local, 'Chromium', 'Application', 'chrome.exe'), join(programFiles, 'Chromium', 'Application', 'chrome.exe')],
    brave: [
      join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ],
    vivaldi: [join(local, 'Vivaldi', 'Application', 'vivaldi.exe'), join(programFiles, 'Vivaldi', 'Application', 'vivaldi.exe')],
  };
}

function macPaths() {
  return {
    chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    vivaldi: ['/Applications/Vivaldi.app/Contents/MacOS/Vivaldi'],
  };
}

function linuxPaths() {
  return {
    chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'],
    edge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/opt/microsoft/msedge/msedge'],
    chromium: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
    brave: ['/usr/bin/brave-browser', '/opt/brave.com/brave/brave'],
    vivaldi: ['/usr/bin/vivaldi', '/opt/vivaldi/vivaldi'],
  };
}

function tableFor(plat, env) {
  if (plat === 'win32') return windowsPaths(env);
  if (plat === 'darwin') return macPaths();
  return linuxPaths();
}

/**
 * Candidate executables for `name`. `auto` returns every known browser in a
 * stable preference order (Chrome, Edge, Chromium, Brave, Vivaldi).
 * An explicit path is returned as-is.
 */
export function browserExecutableCandidates(name = 'auto', env = process.env, plat = process.platform) {
  if (name.includes('/') || name.includes('\\')) return [name];
  const table = tableFor(plat, env);
  const wanted = name === 'auto' ? NAMES : [name];
  const out = [];
  for (const browser of wanted) {
    for (const candidate of table[browser] ?? []) out.push(candidate);
  }
  return out;
}

export function findBrowserExecutable(name = 'auto', env = process.env, plat = process.platform) {
  for (const candidate of browserExecutableCandidates(name, env, plat)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function describeBrowsers(env = process.env, plat = process.platform) {
  const table = tableFor(plat, env);
  return Object.entries(table).map(([name, paths]) => {
    const found = paths.find((candidate) => existsSync(candidate)) ?? null;
    return { name, path: found };
  });
}