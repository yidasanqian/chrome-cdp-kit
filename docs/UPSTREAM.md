# Upstream baseline and tracking

## Baseline

- Upstream: <https://github.com/pasky/chrome-cdp-skill>
- Baseline release: **v1.1.0**, commit **`ffea76a2`** (2026-06-28)
- License: MIT, Copyright (c) 2026 pasky
- At baseline time: 3287 stars, 14 open issues, no test suite, one 882-line CLI

The git history of this repository starts from that commit, so future upstream releases can be merged instead of copied.

## What stays upstream

These files are upstream code and should remain diff-clean:

- `skills/chrome-cdp/scripts/cdp.mjs`
- `skills/chrome-cdp/SKILL.md` (this project only appends a section)
- `LICENSE` (adds the project copyright line)

## The entire extension patch surface

Two hunks in `cdp.mjs`, both marked `chrome-cdp-kit`:

1. **USAGE**: five lines listing `auth`, `launch`, `doctor`.
2. **Dispatch hook** in `main()`:

   ```js
   // chrome-cdp-kit extension hook: additions live in ./kit/cli.mjs (do not move)
   if (cmd && !cmd.startsWith('_')) {
     const { handles, run: runKit } = await import('./kit/cli.mjs');
     if (handles(cmd)) { await runKit(cmd, args); return; }
   }
   ```

Everything else lives in `skills/chrome-cdp/scripts/kit/`. Keeping the patch surface this small is the point: upstream merges are mechanical.

## Sync procedure

```bash
git remote add upstream https://github.com/pasky/chrome-cdp-skill   # already configured
git fetch upstream
git switch -c sync/upstream-$(date +%Y%m%d)
git merge upstream/main
npm run check
```

Conflict checklist:

- If upstream changed `USAGE`, keep their wording and re-add the five kit lines.
- If upstream changed `main()` before the dispatch point, re-insert the hook **after** the help branch and **before** the command branches.
- If upstream adds a command named `auth`, `launch`, or `doctor`, rename the kit command rather than shadowing it.
- If upstream adds tests or changes the package layout, move kit tests accordingly; do not duplicate their harness.

After merging, bump the version (minor for upstream features, patch for fixes), update `CHANGELOG.md` with the new upstream commit, and tag.

## Versioning

- This project follows SemVer on top of the upstream version: `1.2.0` = upstream `1.1.0` + these features.
- The version in `package.json` is the single source; `cdp auth --help` reads it at runtime.

## Release

```bash
npm test
git tag v1.2.0 && git push origin v1.2.0
```

Publishing to npm (`chrome-cdp-kit` was free at baseline time) and to pi (`pi install git:...@v1.2.0`) are separate opt-in steps; do not publish without checking the package contents (`npm pack --dry-run`).

## Compatibility promise

- Upstream commands and their arguments do not change.
- New commands are additive and namespaced (`auth …`) or clearly new (`launch`, `doctor`).
- No new runtime dependencies; Node 22+ only.
- If an upstream change breaks an invariant here, the deviation is documented in `CHANGELOG.md` rather than silently diverging.

## Issue triage

Upstream has open issues that may already be fixed here. When triaging:

1. Reproduce on this checkout (`npm test`, then a live smoke).
2. If the fix is generic, keep it upstream-shaped and mark the hunk — it may be portable back as a PR.
3. If it is specific to the new commands (auth transfer, doctor), keep it under `scripts/kit/`.