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

The daemon's own error is written to `<runtime>/daemon-<id>.log` and surfaces verbatim, so a
rejected upgrade or a listen conflict reports its real cause instead of this message.

`cdp open` no longer costs a prompt of its own: it reuses the browser daemon, and only the new tab
needs an approval on its first page command.

## Repeated "Allow remote debugging?" prompts

The dialog is per **connection**, and a profile with saved data asks every time a new one
appears — there is no "always allow". Each source of new connections:

| Connection | When it is created | Cost |
|---|---|---|
| browser daemon (`cdp-browser-<uuid>`) | first `list` / `open` on a browser start | one prompt, reused until 20 min idle or `cdp stop` |
| tab daemon (`cdp-<targetId>`) | first page command per tab | one prompt per tab, reused the same way |
| `cdp auth …` / `launch` / `doctor` | every run | one prompt per run |

So if prompts keep coming back, something is making new connections: a new tab (`open`), a
browser restart (new UUID), a daemon that went idle for 20 minutes, or `cdp stop`. Page commands
on the *same* tab do not prompt again.

The CLI waits ~6 s for the daemon socket. Click **Allow** inside that window; if you are slower the
command exits, but the daemon keeps waiting and serves the next call without a second prompt.

`cdp stop` with no target drops the browser daemon and every tab daemon. To stop the prompts
entirely, use a dedicated profile (`cdp launch --profile DIR`) — see
[docs/AUTH-TRANSFER.md](AUTH-TRANSFER.md).

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