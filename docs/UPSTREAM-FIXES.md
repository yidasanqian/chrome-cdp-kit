# Upstream issue fixes

Upstream: [pasky/chrome-cdp-skill](https://github.com/pasky/chrome-cdp-skill) at **v1.1.0** (`ffea76a2`).
This document maps every open upstream issue to what this repo does about it, with the commands that prove it.

Legend: **fixed** = code here, **documented** = docs only, **open** = still unsolved here.

| # | Upstream issue | Status here | Where | Verify |
|---|---|---|---|---|
| [#40](https://github.com/pasky/chrome-cdp-skill/issues/40) | Chromium 128+ rejects WebSocket upgrades that are not allowlisted, surfacing as `WebSocket error: error` | **fixed + documented** | `kit/launch.mjs` (`launchArgs`), `cdp.mjs` (`connectError`) | `npm test -- --test-name-pattern="allowlist"`, then `cdp launch` and connect |
| [#24](https://github.com/pasky/chrome-cdp-skill/issues/24) | No way to drag on a canvas (three.js scenes) — only `click`/`clickxy` | **fixed** | `cdp.mjs` (`dragStr`) | `cdp drag <target> 100 100 400 300 20` on any canvas |
| [#19](https://github.com/pasky/chrome-cdp-skill/issues/19) | `listen EPERM` on the per-tab Unix socket in sandboxes → every page command dies | **fixed** (opt-in `CDP_DAEMON_TCP=1`) | `kit/ipc.mjs`, `cdp.mjs` | `CDP_DAEMON_TCP=1 cdp snap <target>` in the restricted sandbox |
| [#38](https://github.com/pasky/chrome-cdp-skill/issues/38) | "Thanks for chrome-cdp-skill" (not a defect) | **documented** | this file, `README.md` | — |
| [#22](https://github.com/pasky/chrome-cdp-skill/issues/22) | "Still asks Allow every command" (closed by maintainer: one prompt per tab is intentional) | **cheaper, not suppressed**: `list`/`open` share a browser-level daemon, `cdp auth` uses one connection per run | `cdp.mjs` (`runBrowserDaemon`), `docs/TROUBLESHOOTING.md` | `test/browser-daemon.test.mjs` |
| [#34](https://github.com/pasky/chrome-cdp-skill/issues/34) | GROWTH.md with promotion strategies (closed) | **this repo's answer**: [TRAFFIC.md](TRAFFIC.md) | — | — |

## #40 — Chromium 128+ origin allowlist

Chromium 111+ gained `--remote-allow-origins`; from 128 the WebSocket endpoint enforces the
allowlist and the `chrome://inspect` toggle does **not** populate it for external clients. Two
failure modes, both currently reported as `WebSocket error: error`:

- upgrade without an `Origin` header → connection silently closed,
- upgrade with a non-allowlisted `Origin` → HTTP 403 with an explanatory body.

What changed here:

1. `launchArgs()` in `kit/launch.mjs` adds `--remote-allow-origins=*`, so every browser started by
   `cdp launch` / `cdp auth sync` is reachable.
2. `connectError()` in `cdp.mjs` probes `<origin>/json/version` on handshake failure. If that HTTP
   endpoint still answers, the debug port is alive and the cause is the allowlist; the CLI then
   says so and names the flag instead of `WebSocket error: error`.
3. A rejected upgrade that arrives as a bare `close` (no `error` event) used to leave the connect
   promise unsettled, so `cdp list` hung instead of printing anything. `CDP#connect` now rejects on
   close-before-open with the same probe and message.

For a browser that was started by hand (your daily profile), the flag has to be added at launch
time — the toggle alone cannot do it:

```bash
# macOS
open -a "Google Chrome" --args --remote-allow-origins='*'
# Linux
google-chrome --remote-allow-origins='*' &
# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-allow-origins='*'
```

`--remote-allow-origins='*'` is a real widening of the local trust boundary: any page that can reach
the port may drive a debugging session. Prefer a concrete origin, or let `cdp launch` start a
dedicated profile where the risk is bounded.

## #24 — drag on a canvas

```bash
cdp drag <target> <x1> <y1> <x2> <y2> [steps]
```

Sequence: `mouseMoved` (no buttons) → `mousePressed` (`buttons=1`) → `steps` interpolated
`mouseMoved` events with `buttons=1` → `mouseReleased`. Default 10 steps, capped at 50. Steps matter:
a single jump from press to release reads as a teleport, and most canvas libraries (three.js
`OrbitControls`, fabric.js, Excalidraw) need intermediate moves to enter their drag state.

Coordinates are CSS pixels, same conversion as `clickxy` — `CSS px = screenshot px / DPR`, and `shot`
prints the DPR.

## #19 — daemon over loopback TCP

The upstream daemon binds a Unix socket (`$XDG_RUNTIME_DIR/cdp-<id>.sock`) or a Windows named pipe.
Sandboxes that deny `AF_UNIX` `bind()` fail with `listen EPERM` and every page command dies; only
`list` survives because it connects to Chrome directly.

Here the transport is switchable:

```bash
CDP_DAEMON_TCP=1 cdp snap <target>
CDP_DAEMON_TCP=1 cdp eval <target> "document.title"
CDP_DAEMON_TCP=1 cdp stop
```

Same newline-delimited JSON protocol, same daemon lifetime, same consent behaviour. Differences:

| | Unix socket / named pipe | `CDP_DAEMON_TCP=1` |
|---|---|---|
| Address | `${XDG_RUNTIME_DIR:-~/.cache}/cdp/cdp-<id>.sock` | ephemeral `127.0.0.1` port, published in `cdp-<id>.port` |
| Access control | filesystem permissions (`0700` dir) | random token in the port file, required in every request |
| Discovery | connect to the socket path | read `port\ntoken` from `<runtime>/cdp-<id>.port` |
| Cleanup | socket unlinked on shutdown | port file unlinked on shutdown |

Both transports keep the `0600` port file inside the `0700` runtime directory, so the token is not
readable by other local users. TCP is opt-in: nothing changes for existing setups, and the default
stays the filesystem-limited socket.

> A loopback port is visible to `netstat`/`Get-NetTCPConnection`. The token is what stops another
> local process from speaking the protocol; treat `CDP_DAEMON_TCP=1` as a sandbox-compatibility
> switch, not as the recommended default.

## Reproducing the triage

```bash
npm run check                                  # 24 tests, no dependencies
node --test test/upstream-fixes.test.mjs       # the three fixes only
node skills/chrome-cdp/scripts/cdp.mjs help    # drag + kit commands documented
```

Live smoke (needs a browser with debugging enabled):

```bash
node skills/chrome-cdp/scripts/cdp.mjs list
node skills/chrome-cdp/scripts/cdp.mjs drag <target> 10 10 200 200 15
CDP_DAEMON_TCP=1 node skills/chrome-cdp/scripts/cdp.mjs eval <target> "1+1"
```

## Porting back upstream

All three fixes are kept upstream-shaped so they can be proposed as PRs; the markers are
`// chrome-cdp-kit fix for upstream #NN`. Recommended split (small, reviewable, independently
mergeable):

1. `--remote-allow-origins=*` in a launcher + the actionable handshake error (#40) — docs-only plus
   ~20 lines, lowest controversy.
2. `drag` command (#24) — one function, one dispatch case, one usage line.
3. daemon TCP transport + token (#19) — the maintainer previously pushed back on complexity
   ([comment](https://github.com/pasky/chrome-cdp-skill/issues/19#issuecomment-4062928385)); lead
   with "opt-in via env var, default unchanged" and the enterprise-sandbox use case.

Draft bodies live in [`docs/traffic/`](traffic/). Opening them requires an explicit go-ahead from the
repo owner.