import { resolve } from 'node:path';

/**
 * Daemon IPC addressing shared by the CLI and the per-tab daemon.
 *
 * Upstream binds a Unix socket (`$XDG_RUNTIME_DIR/cdp-<id>.sock`) or a Windows
 * named pipe. Sandboxes that deny AF_UNIX `bind()` with EPERM (upstream #19)
 * break every page command, so `CDP_DAEMON_TCP=1` moves the same newline-
 * delimited JSON protocol onto a loopback port. TCP has no filesystem
 * permissions to inherit, so the port file also carries a random token that the
 * CLI must echo in each request.
 */

export function tcpDaemonEnabled(env = process.env) {
  return /^(1|true|yes)$/i.test(env.CDP_DAEMON_TCP ?? '');
}

export function daemonSocket(runtimeDir, targetId, isWindows = process.platform === 'win32') {
  return isWindows ? `\\\\.\\pipe\\cdp-${targetId}` : resolve(runtimeDir, `cdp-${targetId}.sock`);
}

export function daemonPortFile(runtimeDir, targetId) {
  return resolve(runtimeDir, `cdp-${targetId}.port`);
}

export function formatDaemonEndpoint({ port, token }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid daemon port: ${port}`);
  if (!token) throw new Error('daemon token required');
  return `${port}\n${token}\n`;
}

export function parseDaemonEndpoint(text) {
  const [portLine = '', token = ''] = String(text).trim().split(/\r?\n/);
  const port = Number(portLine.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid daemon port: ${portLine}`);
  if (!token.trim()) throw new Error('daemon token missing');
  return { port, token: token.trim() };
}