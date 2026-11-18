Thanks — I could not reproduce this on Helium/Dia (no macOS build here), but a stub endpoint on Windows reproduces the same two symptoms you describe:

- upgrade without `Origin` → silent close, surfaced as `WebSocket error: error`
- upgrade with a non-allowlisted `Origin` → 403 with the explanatory body

Two things fixed this on my side, both generic:

1. the launcher adds `--remote-allow-origins=*` (or a concrete origin) to the browser it starts;
2. on handshake failure the CLI probes `http://127.0.0.1:<port>/json/version` — if that still
   answers, the port is alive and the cause is the allowlist, so the error now says:

   `WebSocket rejected (...) while http://127.0.0.1:9222/json/version still answers. Chromium 128+ drops WebSocket upgrades from clients it does not allowlist: relaunch the browser with --remote-allow-origins=* (or the exact origin).`

Verified here: `npm run check` (22 tests) plus a stub case — `/json/version` answers 200 while the
upgrade is rejected with 403. The old code printed `WebSocket error: error`; the new code exits 1 in
~300ms with the message above. One more thing worth knowing: when the rejection arrives as a bare
`close` with no `error` event, the connect promise never settled and `cdp list` hung with no output at
all — that is handled now too.

The docs note is in `docs/TROUBLESHOOTING.md`. Working tree with the change, plus tests, is here:
https://github.com/yidasanqian/chrome-cdp-kit (`docs/UPSTREAM-FIXES.md` section #40).
Happy to send it as a PR against this repo if you want it upstream-shaped — the diff is one
function plus one flag.
```

### issue #24（canvas drag）
