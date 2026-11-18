# Contributing

This project builds on `chrome-cdp-skill`; the bar is "keep upstream merges cheap".

## Where changes go

| Change | Location |
|---|---|
| Upstream command behaviour | do not change it here; propose it upstream first |
| New kit command | `skills/chrome-cdp/scripts/kit/cli.mjs` + a module in the same directory |
| Shared helper (port discovery, CDP client, auth) | `scripts/kit/` |
| Docs | `docs/`, `README*.md`, `SKILL.md` (append-only kit section) |
| Tests | `test/` |

Anything that touches `skills/chrome-cdp/scripts/cdp.mjs` beyond the two marked extension hunks needs a reason in the PR: the whole point of the layout is that `git merge upstream/main` stays mechanical.

## Rules

- Node 22+, no runtime dependencies. Standard library first (`node:util`, `node:crypto`, global `WebSocket`).
- New behaviour gets a test. `npm run check` must pass.
- Never commit an auth payload, a profile directory, or a screenshot that contains personal data.
- A kit command that changes the browser must document its consent behaviour and clean up temporary tabs/processes.
- Keep upstream command output stable; scripts and agents depend on it.

## Local loop

```bash
npm run check
node skills/chrome-cdp/scripts/cdp.mjs help
node skills/chrome-cdp/scripts/cdp.mjs doctor
```

For a live smoke, use a **dedicated** profile and some harmless origin:

```bash
node skills/chrome-cdp/scripts/cdp.mjs launch --browser edge --profile "$TEMP/cdp-test" --headless --close-after-import --json
```

## Commits and releases

- One logical change per commit; the message says what changed and why.
- Update `CHANGELOG.md` under `Unreleased` or the next version.
- Bump `package.json`, tag `vX.Y.Z`, and record the upstream baseline commit in the changelog entry.
- Publishing (npm/pi) is an explicit decision per release; check `npm pack --dry-run` first.