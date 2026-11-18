# chrome-cdp-kit

[English](README.md) · [简体中文](README.zh-CN.md)

A Chrome DevTools Protocol toolkit for agents and humans:

- drive the **live browser you already use** — open tabs, logged-in sessions, current page state;
- hand that **login state to a new, independent browser profile** — without closing the first browser, without copying its profile directory.

Built on [chrome-cdp-skill](https://github.com/pasky/chrome-cdp-skill) **v1.1.0** (`ffea76a2`, MIT). The upstream code stays intact; every addition lives in `skills/chrome-cdp/scripts/kit/`. Existing upstream commands, arguments and scripts keep working.

## Compared with the original

| | [chrome-cdp-skill](https://github.com/pasky/chrome-cdp-skill) | chrome-cdp-kit (this repo) |
|---|---|---|
| Drive the live browser / open tabs | yes | yes — same commands and arguments |
| Per-tab daemon, 20 min idle | yes | yes (unchanged) |
| Login-state transfer (cookies + `localStorage`) | — | `cdp auth export / import / sync` |
| Launch an independent profile | — | `cdp launch --profile DIR` |
| Diagnostics | — | `cdp doctor` |
| Automated tests | none | 14 (`node --test`) |
| CI | none | GitHub Actions, Ubuntu + Windows |
| Docs | README + SKILL | + upstream policy, auth-transfer design, roadmap, changelog |
| Runtime dependencies | none, Node 22+ | same |
| Consent model | one prompt per tab (daemon) | upstream commands unchanged; new commands use one connection per browser per run |
| License | MIT | MIT, upstream copyright retained |

No breaking changes to upstream commands: `list`, `snap`, `eval`, `shot`, `html`, `nav`, `net`, `click`, `clickxy`, `type`, `loadall`, `evalraw`, `open`, `stop`.

## What this repo adds

| Addition | Why it matters |
|---|---|
| `cdp auth export/import/sync` | Move cookies and `localStorage` from the live browser into another profile. The source browser decrypts its own cookies, so App-Bound Encryption is irrelevant. |
| `cdp launch --profile DIR` | Start a detached, independent browser on a dedicated profile with its own debugging port. |
| `cdp doctor` | Show detected browsers and `DevToolsActivePort` files, without printing secrets. |
| Tests and CI | Pin the behaviour with `node --test` and GitHub Actions. |
| Maintenance docs | Upstream baseline, the two-hunk extension surface, release process and roadmap. |

## Install

**As a skill** (pi, DSH, Claude Code, Cursor, …):

```bash
pi install git:github.com/yidasanqian/chrome-cdp-kit@v1.2.0
# or copy skills/chrome-cdp/ into wherever your agent loads skills from
```

Remove the original `chrome-cdp` skill first if it is installed: both use the skill name `chrome-cdp`.

**As a CLI:**

```bash
git clone https://github.com/yidasanqian/chrome-cdp-kit
cd chrome-cdp-kit
npm link            # gives you `cdp`
cdp doctor
```

No build step and no `npm install`.

## Enable debugging once

Chrome: `chrome://inspect/#remote-debugging` → turn the switch on.
Edge: `edge://inspect` → the remote-debugging switch (where the version provides it).

If the browser writes `DevToolsActivePort` somewhere non-standard, set `CDP_PORT_FILE` to its full path.

## Upstream commands

```bash
cdp list                              # open tabs + unique target prefixes
cdp snap   <target>                   # accessibility tree
cdp eval   <target> "expression"
cdp shot   <target> [file]            # viewport screenshot + DPR/coordinate hint
cdp html   <target> [selector]
cdp nav    <target> https://...
cdp net    <target>
cdp click  <target> "selector"
cdp clickxy <target> <x> <y>
cdp type   <target> "text"
cdp loadall <target> "selector" [ms]
cdp evalraw <target> <method> [json]
cdp open   [url]                      # new tab → new Allow prompt
cdp stop   [target]
```

## New commands

```bash
# what is visible; no secrets printed
cdp doctor

# read the live browser (one CDP connection, one Allow prompt)
cdp auth export --out auth.json --origin https://github.com --origin https://app.example.com

# write it into a running browser
cdp auth import --auth auth.json --port-file "$TEMP/target-profile/DevToolsActivePort"

# or all three in one run, keeping the payload in memory
cdp auth sync --browser edge --profile "$TEMP/cdp-profile" \
  --origin https://github.com --url https://github.com

# start an independent browser and optionally import
cdp launch --browser edge --profile "$TEMP/cdp-profile" --auth auth.json --url https://github.com
```

After `launch` / `sync`, `CDP_PORT_FILE=<profile>/DevToolsActivePort` points any CDP client at the new instance. The launched browser is detached and keeps running after the CLI exits.

| Option | Applies to | Meaning |
|---|---|---|
| `--out FILE` | `auth export` | required; plaintext credentials, mode `0600` on POSIX |
| `--auth FILE` | `auth import`, `launch` | payload to write |
| `--origin URL` | `auth export/sync`, `launch`, `import` | also carry `localStorage` for this origin (repeatable) |
| `--domain DOMAIN` | `auth export/sync` | only cookies for this domain (repeatable, suffix match) |
| `--port-file FILE` | export/import | use this `DevToolsActivePort` instead of discovery |
| `--source-profile DIR` | export/sync | use `DIR/DevToolsActivePort` as the source |
| `--profile DIR` | launch/sync/import | target profile (dedicated only; never the daily profile) |
| `--browser NAME` | launch/sync | `chrome`, `edge`, `chromium`, `brave`, `vivaldi`, or a path |
| `--url URL` | launch/sync | page to open, default `about:blank` |
| `--headless` | launch/sync | run headless |
| `--close-after-import` | launch/sync | close the new browser when done |
| `--json` | new commands | machine-readable summary |
| `--timeout MS` | new commands | connect/navigation timeout, default 15000 |

Source discovery picks the **newest** existing default-profile `DevToolsActivePort`. When several browsers are running, pass `--port-file` explicitly.

## Consent, daemons, and what cannot be avoided

Chrome/Edge ask **"Allow remote debugging?"** when a new CDP connection attaches to a profile that holds saved data. That is a security boundary, not a bug:

- a fresh profile has no data and no logins; a profile with logins will always ask;
- upstream page commands hold **one daemon per tab**, so each tab prompts once and reuses the daemon for 20 idle minutes;
- the new auth commands hold **one browser-level connection per browser per run**, so a `sync` shows at most two prompts (source + new instance).

No tool can give you "independent instance + live logins + zero consent" at once. This project documents the trade-off instead of hiding it.

## Security

`auth.json` is plaintext authentication material. Prefer `auth sync` (memory only); delete exported files; never commit or paste them; use a throwaway `--profile` and remove it afterwards. See [SECURITY.md](SECURITY.md).

## Maintenance

- Upstream baseline, patch surface and sync procedure: [docs/UPSTREAM.md](docs/UPSTREAM.md)
- Auth-transfer design and protocol calls: [docs/AUTH-TRANSFER.md](docs/AUTH-TRANSFER.md)
- Planned work: [docs/ROADMAP.md](docs/ROADMAP.md)
- Changes: [CHANGELOG.md](CHANGELOG.md)

```bash
npm test        # 14 tests, no dependencies
npm run check   # syntax + tests
```

## License and attribution

MIT. Upstream code Copyright (c) 2026 pasky; additions Copyright (c) 2026 yidasanqian. See [LICENSE](LICENSE) and [NOTICE](NOTICE).