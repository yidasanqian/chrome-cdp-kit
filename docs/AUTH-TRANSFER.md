# Login-state transfer

## Problem

"Use my existing logins in a separate browser" is blocked by three Chromium properties:

1. **A profile has one owner.** A second process on the same `--user-data-dir` hands its command line to the first and exits (`SingletonLock` on POSIX, a named mutex on Windows).
2. **Storage is per profile.** Cookies and `localStorage` live under the profile directory; a new `--user-data-dir` starts empty.
3. **The on-disk secrets are hard to read.** The cookie SQLite database and the `localStorage` LevelDB are locked while the browser runs, and current Chromium builds encrypt cookie values with App-Bound Encryption, so copying `Cookies` + `Local State` no longer decrypts from another process.

Any tool that appears to "reuse the profile in a new instance" is therefore doing one of: copying the profile, reading the databases from disk, or **asking the browser to hand the data out over CDP**. This project takes the last route.

## Architecture

```
live browser ──(one WebSocket)──> kit/cli ──(one WebSocket)──> new browser
      ▲                              │                            ▲
      └── DevToolsActivePort         │ auth payload (memory)      └── --user-data-dir=<new>
                                     └── Storage.getCookies / setCookies
                                         Runtime.evaluate localStorage
```

- **One browser-level connection per browser per run.** Flattened sessions (`Target.attachToTarget { flatten: true }`) address tabs without opening more connections, so the browser's consent prompt is per browser, not per tab.
- **A temporary background tab** is created for storage work and closed afterwards; the user's own tabs are never navigated. (The upstream daemon commands keep their per-tab sessions; auth commands do not touch them.)
- **No daemon for auth.** The process exits when the command finishes. The browser it launched stays alive because it was spawned detached.
- **No profile copy.** Only cookies and the `localStorage` of named origins move.

## Protocol sequence

### export

1. `Target.createTarget { url: "about:blank", background: true }`
2. `Target.attachToTarget { targetId, flatten: true }`
3. `Storage.getCookies` (default browser context; the browser decrypts, so ABE does not matter)
4. For each `--origin`: `Page.navigate`, poll `Runtime.evaluate("document.readyState")`, read `location.origin`, then `Runtime.evaluate` a `JSON.stringify(Object.fromEntries(Object.entries(localStorage)))`
5. `Target.closeTarget`

### import

1. Same tab setup.
2. `Storage.setCookies` in batches of 100 (HttpOnly, SameSite, session and partitioned cookies are preserved).
3. For each origin: `Page.navigate`, wait for `complete`, `localStorage.setItem` for every key, wait 150 ms so the renderer can flush, then continue.
4. `Target.closeTarget`.

### launch

`spawn(browser, ["--user-data-dir=<dir>", "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", url], { detached: true })`, then poll `<dir>/DevToolsActivePort` for a file newer than the launch timestamp. The timestamp guard avoids accepting a stale port file from a previous run.

## Consent model

The "Allow remote debugging?" dialog is the browser asking whether an external client may control a session that contains saved data. It is **per connection**, and it is orthogonal to profile choice:

- a fresh profile has no data and no logins;
- a profile with logins will ask, whether it is the daily profile, a clone, or the new instance after import;
- upstream page commands deliberately hold a daemon per tab so the prompt appears once per tab; `list` / `open` hold one browser-level daemon per browser start, so tab discovery stops costing a prompt per call; the new auth commands hold one connection per browser per run.

This project accepts the boundary. It does not attempt to suppress the prompt.

## Failure modes

| Case | Behaviour |
|---|---|
| No source port file | `auth export` / `auth sync` fail before connecting |
| Prompt not approved | `CDP connect timeout` (default 15 s) |
| Target profile already running | no new `DevToolsActivePort`; launch times out with a hint |
| Origin unreachable | recorded in `errors[]`; other origins still imported |
| Cookie with `partitionKey` | passed through unchanged; CHIPS keeps working |
| `auth.version` unknown | import refuses before touching the browser |
| Source = target profile | `auth sync` refuses |

## What is not transferred

`sessionStorage`, IndexedDB, Cache Storage, service workers, extensions, history and the HTTP auth cache. Those are either short-lived, not auth-related, or would turn the tool into a profile clone.

## Alternatives considered

- **Read the cookie database from disk** (`browser_cookie3`, `rookiepy`): works on older Chromium, breaks with App-Bound Encryption, covers cookies only.
- **Copy the profile directory**: full fidelity, but the browser must be closed (or snapshotted via VSS) and the two profiles diverge immediately.
- **Extension bridge**: drives the existing session, not a new instance.
- **Playwright `storageState`**: the same idea, but requires the source to be a Playwright-controlled context; this reads from the user's real browser.

## Open questions

- Enumerating every origin without visiting it is not supported; `--origin` is explicit by design.
- Some apps keep auth in IndexedDB; a future opt-in could transfer it, at the cost of more sensitive data.
- A resident mode would remove repeated prompts at the cost of a daemon; upstream already has the daemon machinery for tabs.