# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), SemVer on top of the upstream version.

## [Unreleased]

### Changed

- Packaging is CI-only (`.github/workflows/release.yml`): a tag push runs the tests, checks the tag
  against `package.json`, and writes the GitHub Release notes from `CHANGELOG.md`
  (`scripts/release-notes.mjs`). No credentials: the default `GITHUB_TOKEN` is enough.
- No npm package, deliberately. The skill installs from git (`/plugin marketplace add`, `npx skills add`),
  so a registry entry would only add a global `cdp` binary plus a credential to rotate and a version to
  keep in sync. The CLI-only section documents the clone route instead.
- `workflow_dispatch` re-runs the release for an existing tag and refreshes its notes.

## [1.3.0] - 2026-11-18


Upstream baseline unchanged: chrome-cdp-skill **v1.1.0** (`ffea76a2`). This release ports fixes for three open upstream issues.

### Added

- `cdp drag <target> <x1> <y1> <x2> <y2> [steps]` — press -> interpolated `mouseMoved` -> release, for canvas scenes (upstream [#24](https://github.com/pasky/chrome-cdp-skill/issues/24)).
- `CDP_DAEMON_TCP=1` — per-tab daemon over loopback TCP, gated by a token in the port file, for sandboxes that deny `AF_UNIX` bind with `EPERM` (upstream [#19](https://github.com/pasky/chrome-cdp-skill/issues/19)).
- `skills/chrome-cdp/scripts/kit/ipc.mjs` — daemon addressing, endpoint file format, transport switch.
- `docs/UPSTREAM-FIXES.md`, `docs/TROUBLESHOOTING.md`, `docs/TRAFFIC.md`, `docs/traffic/` (issue replies, PR bodies, launch copy).
- `test/upstream-fixes.test.mjs` — 7 tests for the three fixes (22 total).

### Fixed

- Chromium 128+ handshake rejection no longer surfaces as `WebSocket error: error`: the CLI probes `/json/version` and names `--remote-allow-origins=*` (upstream [#40](https://github.com/pasky/chrome-cdp-skill/issues/40)).
- `CDP#connect` rejects when the rejected upgrade arrives as a bare `close`; a handshake that never opens used to leave the promise unsettled, so `cdp list` hung instead of printing the cause.
- `cdp launch` / `cdp auth sync` pass `--remote-allow-origins=*`, so the browsers they start are reachable.

### Changed

- `launchArgs()` exported from `kit/launch.mjs` so launch flags are testable.
- Install and uninstall follow the ecosystem conventions instead of a bespoke flow: `.claude-plugin/marketplace.json` for `/plugin marketplace add`, and `npx skills add/remove` for other agents. Clone-and-copy instructions moved to a CLI-only subsection.
- `docs/UPSTREAM.md` patch surface lists the three `upstream #NN` hunks.

### Compatibility

- Upstream commands keep their behaviour, arguments and daemon model; the TCP transport is opt-in and the default path is unchanged.
- No new runtime dependencies; Node 22+.

## [1.2.0] - 2026-11-18


Upstream baseline: chrome-cdp-skill **v1.1.0** (`ffea76a2`, 2026-06-28).

### Added

- `cdp auth export --out FILE` — read cookies and per-`--origin` `localStorage` from the live browser over one CDP connection.
- `cdp auth import --auth FILE` — write an auth payload into an already running browser.
- `cdp auth sync --profile DIR` — export, launch an independent browser and import, keeping the payload in memory.
- `cdp launch --profile DIR [--auth FILE]` — start a detached browser on a dedicated profile with an ephemeral debugging port.
- `cdp doctor` — list detected browsers and `DevToolsActivePort` files without printing secrets.
- Kit modules under `skills/chrome-cdp/scripts/kit/`, wired through one dispatch hook.
- Tests (`node --test`) for port parsing, cookie mapping/filtering, batched import, options, dispatch and CLI help.
- CI workflow, `docs/UPSTREAM.md`, `docs/AUTH-TRANSFER.md`, `docs/ROADMAP.md`, this changelog.

### Changed

- `package.json` renamed to `chrome-cdp-kit@1.2.0`, exposes a `cdp` bin, keeps the `pi.skills` field.
- `LICENSE` adds the project copyright on top of the upstream MIT notice.
- `README.md` rewritten with a comparison against the original; Chinese mirror added.

### Compatibility

- All upstream commands (`list`, `snap`, `eval`, `shot`, `html`, `nav`, `net`, `click`, `clickxy`, `type`, `loadall`, `evalraw`, `open`, `stop`) keep their behaviour, arguments and daemon model.
- No new runtime dependencies; Node 22+.

## Upstream history

- **v1.1.0** (2026-06-28): last upstream release; flatpak browser paths merged earlier (2026-03-18).
- **v1.0.1**: initial public pi skill.