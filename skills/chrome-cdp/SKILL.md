---
name: chrome-cdp
description: Interact with the local Chrome/Edge session over CDP — list tabs, screenshot, snapshot, drive canvas drags, and transfer cookies plus localStorage into an independent browser profile (only on explicit user approval after being asked to inspect, debug, or interact with a page open in Chrome)
---

# Chrome CDP

> **Maintained distribution: chrome-cdp-kit.** Upstream commands are unchanged; the additions are listed at the end. Based on chrome-cdp-skill v1.1.0 (`ffea76a2`, MIT).

Lightweight Chrome DevTools Protocol CLI. Connects directly via WebSocket — no Puppeteer, works with 100+ tabs, instant connection.

## Prerequisites

- Chrome (or Chromium, Brave, Edge, Vivaldi) with remote debugging enabled: open `chrome://inspect/#remote-debugging` and toggle the switch
- Node.js 22+ (uses built-in WebSocket)
- If your browser's `DevToolsActivePort` is in a non-standard location, set `CDP_PORT_FILE` to its full path

## Commands

All commands use `scripts/cdp.mjs`. The `<target>` is a **unique** targetId prefix from `list`; copy the full prefix shown in the `list` output (for example `6BE827FA`). The CLI rejects ambiguous prefixes.

### List open pages

```bash
scripts/cdp.mjs list
```

### Take a screenshot

```bash
scripts/cdp.mjs shot <target> [file]    # default: screenshot-<target>.png in runtime dir
```

Captures the **viewport only**. Scroll first with `eval` if you need content below the fold. Output includes the page's DPR and coordinate conversion hint (see **Coordinates** below).

### Accessibility tree snapshot

```bash
scripts/cdp.mjs snap <target>
```

### Evaluate JavaScript

```bash
scripts/cdp.mjs eval <target> <expr>
```

> **Watch out:** avoid index-based selection (`querySelectorAll(...)[i]`) across multiple `eval` calls when the DOM can change between them (e.g. after clicking Ignore, card indices shift). Collect all data in one `eval` or use stable selectors.

### Other commands

```bash
scripts/cdp.mjs html    <target> [selector]   # full page or element HTML
scripts/cdp.mjs nav     <target> <url>         # navigate and wait for load
scripts/cdp.mjs net     <target>               # resource timing entries
scripts/cdp.mjs click   <target> <selector>    # click element by CSS selector
scripts/cdp.mjs clickxy <target> <x> <y>       # click at CSS pixel coords
scripts/cdp.mjs drag    <target> <x1> <y1> <x2> <y2> [steps]  # press -> move -> release (canvas drag)
scripts/cdp.mjs type    <target> <text>         # Input.insertText at current focus; works in cross-origin iframes unlike eval
scripts/cdp.mjs loadall <target> <selector> [ms]  # click "load more" until gone (default 1500ms between clicks)
scripts/cdp.mjs evalraw <target> <method> [json]  # raw CDP command passthrough
scripts/cdp.mjs open    [url]                  # open new tab (each triggers Allow prompt)
scripts/cdp.mjs stop    [target]               # stop daemon(s)
```

## Coordinates

`shot` saves an image at native resolution: image pixels = CSS pixels × DPR. CDP Input events (`clickxy` etc.) take **CSS pixels**.

```
CSS px = screenshot image px / DPR
```

`shot` prints the DPR for the current page. Typical Retina (DPR=2): divide screenshot coords by 2.

## Tips

- Prefer `snap --compact` over `html` for page structure.
- Use `type` (not eval) to enter text in cross-origin iframes — `click`/`clickxy` to focus first, then `type`.
- Chrome shows an "Allow debugging" modal once per tab on first access. A background daemon keeps the session alive so subsequent commands need no further approval. Daemons auto-exit after 20 minutes of inactivity.

## Troubleshooting

- `WebSocket error: error` / `WebSocket rejected ...`: Chromium 128+ origin allowlist. Relaunch the browser with `--remote-allow-origins=*`; `launch` / `auth sync` already pass it.
- `listen EPERM ... cdp-*.sock`: the sandbox denies Unix socket `bind()`. Set `CDP_DAEMON_TCP=1`; the daemon then uses a loopback port published with a token in `<runtime>/cdp-<id>.port`.
- Canvas drag does nothing: use `drag`, not `clickxy` — a click sends no intermediate `mouseMoved` events with `buttons: 1`.
- An Allow prompt on every command: each tab gets its own daemon. `auth` / `launch` / `doctor` use one browser-level connection per run instead.


## Kit additions (chrome-cdp-kit)

Kit commands use **one browser-level connection per browser per run** (not a per-tab daemon), so a consent prompt appears at most once per browser per run.

```bash
# what is visible; no secrets printed
scripts/cdp.mjs doctor

# read the live browser (one connection, one Allow prompt)
scripts/cdp.mjs auth export --out auth.json --origin https://github.com

# write into an already running browser
scripts/cdp.mjs auth import --auth auth.json --port-file "$TEMP/target-profile/DevToolsActivePort"

# export → launch a dedicated profile → import, keeping the payload in memory
scripts/cdp.mjs auth sync --browser edge --profile "$TEMP/cdp-profile" --origin https://github.com

# start an independent browser, optionally importing a payload
scripts/cdp.mjs launch --profile "$TEMP/cdp-profile" --auth auth.json --url https://github.com
```

Rules:

- `--profile` must be a **dedicated** directory; never the user's daily profile.
- `auth.json` is plaintext credentials. Prefer `auth sync`; delete exports; never commit or paste them.
- The browser may ask "Allow remote debugging?" (source and, for a profile with data, the target). Ask the user to approve once; do not loop.
- After launch/sync, point other clients at the new instance with `CDP_PORT_FILE="$TEMP/cdp-profile/DevToolsActivePort"`.
- Device-bound sessions and 2FA may still require re-verification; report that instead of retrying.
- Only `localStorage` for origins passed with `--origin` moves; `sessionStorage`/IndexedDB do not.
