# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), SemVer on top of the upstream version.

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