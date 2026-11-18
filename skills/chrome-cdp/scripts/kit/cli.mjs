/**
 * chrome-cdp-kit additions.
 *
 * Loaded through exactly one hook in ../cdp.mjs. Keep upstream code out of this
 * directory so `git merge upstream/main` only conflicts on the two marked
 * hunks (USAGE and the dispatch hook).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { connect } from './client.mjs';
import { parseDomains, parseOptions, parseOrigins, parseTimeout } from './args.mjs';
import { exportAuth, importAuth } from './auth.mjs';
import { launchBrowser } from './launch.mjs';
import { describeBrowsers } from './browsers.mjs';
import { describePortFiles, findPortFile, portFileToWs } from './portfile.mjs';

const VERSION = JSON.parse(await readFile(new URL('../../../../package.json', import.meta.url), 'utf8')).version;

export const KIT_COMMANDS = ['auth', 'launch', 'doctor'];

export function handles(command) {
  return KIT_COMMANDS.includes(command);
}

const AUTH_HELP = `cdp auth ${VERSION} — move a live browser's login state into another profile

Usage:
  cdp auth export --out <file> [--origin <url>]... [--domain <domain>]...
      Read cookies (+ localStorage for each --origin) from the live browser.

  cdp auth import --auth <file> [--port-file <file> | --profile <dir>] [--origin <url>]...
      Write a payload into an already running browser.

  cdp auth sync --profile <dir> [--browser <name>] [--url <url>] [--origin <url>]...
      Export, launch an independent browser and import — nothing written to disk.

Source selection:
  --port-file FILE          use this DevToolsActivePort (wins over discovery)
  --source-profile DIR      use DIR/DevToolsActivePort
  (default)                 the newest existing default-profile DevToolsActivePort

Options:
  --timeout MS              connect/navigation timeout, default 15000
  --json                    machine-readable summary
  -h, --help                this text

auth files are plaintext credentials. Prefer "auth sync", and delete exports.
The browser may ask "Allow remote debugging?" once per browser per run.
`;

const LAUNCH_HELP = `cdp launch ${VERSION} — start an independent browser profile

Usage:
  cdp launch --profile <dir> [--auth <file>] [--browser <name>] [--url <url>]
             [--headless] [--close-after-import]

  --profile DIR             required; a dedicated directory, never your daily profile
  --auth FILE               import this payload after the browser starts
  --browser NAME            chrome | edge | chromium | brave | vivaldi | /path/to/browser
  --url URL                 page to open, default about:blank
  --headless                start headless (automation)
  --close-after-import      close the new browser when done
  --json                    machine-readable summary
`;

const DOCTOR_HELP = `cdp doctor ${VERSION} — show detected browsers and debugging ports

Usage:
  cdp doctor [--json]

  --json                    machine-readable summary
`;

function wsFor(portFile) {
  try {
    return portFileToWs(portFile);
  } catch (error) {
    throw new Error(`cannot use ${portFile}: ${error.message}`);
  }
}

function resolveSourcePort(values) {
  if (values['port-file']) return values['port-file'];
  if (values['source-profile']) return join(values['source-profile'], 'DevToolsActivePort');
  const found = findPortFile();
  if (!found) {
    throw new Error(
      'no DevToolsActivePort found; enable remote debugging (chrome://inspect/#remote-debugging, edge://inspect) or pass --port-file',
    );
  }
  return found;
}

function resolveTargetPort(values) {
  if (values['port-file']) return values['port-file'];
  if (values.profile) return join(values.profile, 'DevToolsActivePort');
  return resolveSourcePort(values);
}

function report(values, payload, human) {
  if (values.json) console.log(JSON.stringify(payload));
  else human(payload);
}

function printErrors(errors) {
  for (const error of errors ?? []) console.error(`! ${error.origin}: ${error.message}`);
}

async function exportCommand(values, origins, domains, timeoutMs) {
  if (!values.out) throw new Error('--out is required because the payload contains credentials');
  const portFile = resolveSourcePort(values);
  const send = await connect(wsFor(portFile));
  try {
    const auth = await exportAuth({ send, origins, domains, timeoutMs });
    await writeFile(values.out, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
    report(
      values,
      { portFile, out: values.out, cookies: auth.cookies.length, origins: Object.keys(auth.localStorage) },
      (summary) => console.log(`✓ ${summary.cookies} cookies, ${summary.origins.length} origins → ${summary.out}`),
    );
    printErrors(auth.errors);
  } finally {
    send.close();
  }
}

async function importCommand(values, origins, timeoutMs) {
  if (!values.auth) throw new Error('--auth is required');
  const auth = JSON.parse(await readFile(values.auth, 'utf8'));
  const portFile = resolveTargetPort(values);
  const send = await connect(wsFor(portFile));
  try {
    const result = await importAuth({ send, auth, origins, timeoutMs });
    report(values, { portFile, ...result }, (summary) => {
      console.log(`✓ ${summary.cookies} cookies, ${summary.origins.length} origins → ${portFile}`);
    });
    printErrors(result.errors);
  } finally {
    send.close();
  }
}

async function syncCommand(values, origins, domains, timeoutMs) {
  if (!values.profile) throw new Error('--profile is required (use a dedicated directory, never your daily profile)');
  if (values['source-profile'] && resolve(values['source-profile']) === resolve(values.profile)) {
    throw new Error('source and target profiles must differ');
  }
  const sourcePort = resolveSourcePort(values);
  const source = await connect(wsFor(sourcePort));
  let auth;
  try {
    auth = await exportAuth({ send: source, origins, domains, timeoutMs });
  } finally {
    source.close();
  }

  const launched = await launchBrowser({
    browser: values.browser ?? 'auto',
    profile: values.profile,
    url: values.url ?? 'about:blank',
    headless: Boolean(values.headless),
  });
  const target = await connect(launched.wsUrl);
  let result;
  let closed = false;
  try {
    result = await importAuth({ send: target, auth, origins, timeoutMs });
    if (values['close-after-import']) {
      await target('Browser.close').catch(() => {});
      closed = true;
    }
  } finally {
    target.close();
  }

  report(
    values,
    {
      sourcePort,
      executable: launched.executable,
      profile: launched.profile,
      portFile: launched.portFile,
      cookies: result.cookies,
      origins: result.origins,
      closed,
    },
    (summary) => {
      console.log(`source: ${summary.sourcePort}`);
      console.log(`profile: ${summary.profile}`);
      console.log(`✓ ${summary.cookies} cookies, ${summary.origins.length} origins`);
      if (summary.closed) console.log('browser closed (--close-after-import)');
      else console.log(`CDP_PORT_FILE=${summary.portFile}`);
    },
  );
  printErrors(result.errors);
}

async function launchCommand(values, origins, timeoutMs) {
  if (!values.profile) throw new Error('--profile is required (use a dedicated directory, never your daily profile)');
  const payload = values.auth ? JSON.parse(await readFile(values.auth, 'utf8')) : null;
  const closeAfter = Boolean(values['close-after-import']);
  const launched = await launchBrowser({
    browser: values.browser ?? 'auto',
    profile: values.profile,
    url: values.url ?? 'about:blank',
    headless: Boolean(values.headless),
  });

  let result = { cookies: 0, origins: [] };
  let closed = false;
  if (payload || closeAfter) {
    const send = await connect(launched.wsUrl);
    try {
      if (payload) result = await importAuth({ send, auth: payload, origins, timeoutMs });
      if (closeAfter) {
        await send('Browser.close').catch(() => {});
        closed = true;
      }
    } finally {
      send.close();
    }
  }

  report(
    values,
    {
      executable: launched.executable,
      profile: launched.profile,
      portFile: launched.portFile,
      cookies: result.cookies,
      origins: result.origins,
      closed,
    },
    (summary) => {
      console.log(`browser: ${summary.executable}`);
      console.log(`profile: ${summary.profile}`);
      if (payload) console.log(`cookies: ${summary.cookies}, origins: ${summary.origins.length}`);
      if (summary.closed) console.log('browser closed (--close-after-import)');
      else console.log(`CDP_PORT_FILE=${summary.portFile}`);
    },
  );
  if (payload) printErrors(result.errors);
}

async function doctor(values) {
  const ports = describePortFiles();
  const browsers = describeBrowsers();
  if (values.json) {
    console.log(JSON.stringify({ ports, browsers }));
    return;
  }
  console.log('debugging ports:');
  for (const entry of ports) {
    console.log(`  ${entry.exists ? '✓' : '·'} ${entry.file}${entry.mtime ? `  (${entry.mtime})` : ''}`);
  }
  console.log('browsers:');
  for (const browser of browsers) {
    console.log(`  ${browser.path ? '✓' : '·'} ${browser.name.padEnd(9)} ${browser.path ?? ''}`);
  }
  if (!ports.some((entry) => entry.exists)) console.log('\nNo active debugging port. Enable it once in the source browser.');
}

async function runAuth(argv) {
  const [sub, ...rest] = argv;
  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    console.log(AUTH_HELP);
    return;
  }
  if (!['export', 'import', 'sync'].includes(sub)) {
    throw new Error(`unknown auth subcommand: ${sub} (export|import|sync)`);
  }
  const { values, positionals } = parseOptions(rest);
  if (positionals.length > 0) throw new Error(`unexpected argument: ${positionals[0]}`);
  if (values.help) {
    console.log(AUTH_HELP);
    return;
  }
  if (values.version) {
    console.log(VERSION);
    return;
  }
  const timeoutMs = parseTimeout(values.timeout);
  const origins = parseOrigins(values.origin);
  const domains = parseDomains(values.domain);
  if (sub === 'export') return exportCommand(values, origins, domains, timeoutMs);
  if (sub === 'import') return importCommand(values, origins, timeoutMs);
  return syncCommand(values, origins, domains, timeoutMs);
}

async function runLaunch(argv) {
  const { values, positionals } = parseOptions(argv);
  if (positionals.length > 0) throw new Error(`unexpected argument: ${positionals[0]}`);
  if (values.help) {
    console.log(LAUNCH_HELP);
    return;
  }
  if (values.version) {
    console.log(VERSION);
    return;
  }
  const timeoutMs = parseTimeout(values.timeout);
  const origins = parseOrigins(values.origin);
  return launchCommand(values, origins, timeoutMs);
}

async function runDoctor(argv) {
  const { values, positionals } = parseOptions(argv);
  if (positionals.length > 0) throw new Error(`unexpected argument: ${positionals[0]}`);
  if (values.help) {
    console.log(DOCTOR_HELP);
    return;
  }
  return doctor(values);
}

export async function run(command, argv) {
  if (command === 'auth') return runAuth(argv);
  if (command === 'launch') return runLaunch(argv);
  if (command === 'doctor') return runDoctor(argv);
  throw new Error(`unknown kit command: ${command}`);
}