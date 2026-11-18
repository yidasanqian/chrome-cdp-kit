# Troubleshooting

## `WebSocket error: error` (or `WebSocket rejected ...`)

The debug port answered over TCP, but Chromium closed the WebSocket handshake.

Chromium 128+ enforces a WebSocket **Origin allowlist** that the `chrome://inspect` toggle does not
populate. Two symptoms, one cause:

- upgrade with no `Origin` header → connection silently closed (what you see as `WebSocket error: error`);
- upgrade with a non-allowlisted `Origin` → HTTP 403 with an explanatory body.

Relaunch the browser with the flag, then retry:

```bash
# macOS
open -a "Google Chrome" --args --remote-allow-origins='*'
# Linux
google-chrome --remote-allow-origins='*' &
# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-allow-origins='*'
```

`cdp launch` and `cdp auth sync` already pass `--remote-allow-origins=*`.

If `http://127.0.0.1:<port>/json/version` answers but the WebSocket does not, this is the cause. If
neither answers, the port is dead — check `cdp doctor` and the `DevToolsActivePort` file.

## `listen EPERM: operation not permitted ... cdp-*.sock`

A sandbox (container, enterprise MDM, cloud IDE) denied `AF_UNIX` `socket()`/`bind()`. The per-tab
daemon cannot create its socket, so every page command fails while `list` still works.

```bash
export CDP_DAEMON_TCP=1     # PowerShell: $env:CDP_DAEMON_TCP = 1
cdp snap <target>
```

The daemon then listens on an ephemeral loopback port and publishes `port` + a random `token` in
`<runtime>/cdp-<id>.port`. Nothing else changes: same protocol, same 20 minute idle exit, same
consent prompts. Unset the variable to return to the Unix socket / named pipe.

## `No DevToolsActivePort found`

The toggle is off, or the profile lives somewhere non-standard.

1. `cdp doctor` — lists every path this platform checks, marked ✓ / ·.
2. Turn the switch on: Chrome `chrome://inspect/#remote-debugging`, Edge `edge://inspect`.
3. Still nothing: point at the file explicitly — `CDP_PORT_FILE=/full/path/DevToolsActivePort cdp list`
   — or `cdp launch --profile DIR` to get a browser whose port file you own.

## `Daemon failed to start — did you click Allow in Chrome?`

The daemon connects to Chrome before serving the CLI, and Chrome blocks that connection behind the
**Allow remote debugging?** prompt. Approve it once. If no prompt appears, the profile may have the
toggle off, or another library keeps the debugging endpoint busy.

`cdp open` always needs a new approval: a new tab means a new daemon and a new consent.

## Repeated "Allow remote debugging?" prompts

By design: one prompt per tab on first access (upstream behaviour, see
[issue #22](https://github.com/pasky/chrome-cdp-skill/issues/22)). `cdp auth …`, `cdp launch` and
`cdp doctor` use one browser-level connection per run instead, so they cost at most one prompt.

## The screenshot coordinates do not line up

`shot` saves at native resolution: image pixels = CSS pixels × DPR. CDP input events take CSS pixels.

```
CSS px = screenshot px / DPR
```

`shot` prints the DPR and the conversion for the current page. If your image viewer rescales the
image further, divide by that factor too.

## Drag does nothing on the canvas

Use `cdp drag <target> <x1> <y1> <x2> <y2> [steps]`, not `clickxy`. A drag needs the intermediate
`mouseMoved` events between press and release; `steps` default 10 (max 50) controls how many. If the
element is inside an iframe, coordinates are viewport-relative — take a `shot` and measure on it.

## A profile with data always prompts

Expected. Chrome asks before exposing a profile that holds saved data. `cdp launch --profile DIR`
on a dedicated directory is the reproducible path; see
[docs/AUTH-TRANSFER.md](AUTH-TRANSFER.md) for what does and does not move.