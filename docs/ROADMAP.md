# Roadmap

Short list, kept honest. Nothing here is promised for a date.

## Next (v1.3)

- `auth export --all-origins`: enumerate origins from open tabs instead of requiring `--origin` for each site.
- `list --json`: machine-readable target list (upstream's text format stays the default).
- `doctor --json` improvements: daemon count, port file liveness (connect test), browser versions.
- Windows CI: run the test suite on `windows-latest` alongside Ubuntu.
- Upstream issue triage: reproduce and port generic fixes upstream where possible.

## Later

- A resident mode for repeated syncs (one connection kept open), only if the consent trade-off can be documented clearly.
- Playwright `storageState` import/export for interoperability.
- IndexedDB transfer as an explicit `--with-indexeddb` opt-in.
- `auth export --include-session-storage` (per-tab semantics make this awkward; keep it opt-in).

## Non-goals

- Suppressing or automating the "Allow remote debugging" consent.
- Bundling a browser or a WebDriver.
- Multi-user token vaults, cloud sync, or a server component.
- Copying extensions, history, or the whole profile.
- Defeating device-bound sessions, WebAuthn, or risk engines.