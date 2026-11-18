# 可直接使用的文案

占位符：`<TARGET>`（`cdp list` 里的前缀）、`<PORT>`、`<DATE>`。发之前替换，别留角括号。

---

## 1. 上游 issue 回复

### issue #40（Chromium 128+ origin allowlist）

文件：`docs/traffic/issue-40.body.md`

```markdown
Thanks — reproduced on macOS 15 with a Chromium 147 base (Helium), same two symptoms:

- upgrade without `Origin` → silent close, surfaced as `WebSocket error: error`
- upgrade with a non-allowlisted `Origin` → 403 with the explanatory body

Two things fixed this on my side, both generic:

1. the launcher adds `--remote-allow-origins=*` (or a concrete origin) to the browser it starts;
2. on handshake failure the CLI probes `http://127.0.0.1:<port>/json/version` — if that still
   answers, the port is alive and the cause is the allowlist, so the error now says:

   `WebSocket rejected (...) while http://127.0.0.1:9222/json/version still answers. Chromium 128+ drops WebSocket upgrades from clients it does not allowlist: relaunch the browser with --remote-allow-origins=* (or the exact origin).`

The docs note is in `docs/TROUBLESHOOTING.md`. Working tree with the change, plus tests, is here:
https://github.com/yidasanqian/chrome-cdp-kit (`docs/UPSTREAM-FIXES.md` section #40).
Happy to send it as a PR against this repo if you want it upstream-shaped — the diff is one
function plus one flag.
```

### issue #24（canvas drag）

文件：`docs/traffic/issue-24.body.md`

```markdown
Same problem: `clickxy` dispatches moved/pressed/released, which most canvas libraries ignore —
three.js `OrbitControls`, fabric.js and Excalidraw all need intermediate `mouseMoved` events with
`buttons: 1` between press and release to enter their drag state.

Working command in my tree:

```bash
cdp drag <TARGET> <x1> <y1> <x2> <y2> [steps]   # default 10 steps, capped at 50
```

It sends `mouseMoved` (0) → `mousePressed` (1) → N interpolated `mouseMoved` (1) → `mouseReleased`,
all CSS pixels, so the same `CSS px = shot px / DPR` rule as `clickxy` applies.

Implementation is ~15 lines next to `clickXyStr` in `cdp.mjs`; test asserts the help text and the
step cap. https://github.com/yidasanqian/chrome-cdp-kit — `docs/UPSTREAM-FIXES.md` section #24.
```

### issue #19（sandbox EPERM）

文件：`docs/traffic/issue-19.body.md`

```markdown
Confirmed the failure mode: not a permission problem on the socket file, the syscall itself is
denied, so `chmod`/path changes do nothing and every page command dies while `list` still works
(it talks to Chrome directly, no daemon).

I kept the fix opt-in so nobody's setup changes: `CDP_DAEMON_TCP=1` moves the same
newline-delimited JSON protocol to an ephemeral `127.0.0.1` port, published as
`<runtime>/cdp-<id>.port` together with a random token that every request has to echo — TCP has no
filesystem permissions to inherit, so the token is the gate. Same 20 minute idle exit, same
consent prompts, default path untouched.

```bash
CDP_DAEMON_TCP=1 cdp snap <TARGET>
```

~40 lines + tests: https://github.com/yidasanqian/chrome-cdp-kit (`docs/UPSTREAM-FIXES.md`, #19).
I understand the complexity objection from #19 — that is exactly why it is an env-var opt-in and not
a transport rewrite. If you would rather keep it in a fork, no problem; the doc entry alone helps
the next person searching for `listen EPERM`.
```

---

## 2. PR 描述

### PR A（#40，最小争议，先提这一个）

文件：`docs/traffic/pr-40.body.md`

```markdown
## Problem

Chromium 128+ enforces a WebSocket Origin allowlist that `chrome://inspect/#remote-debugging` does
not populate. External clients get a silent close, which this CLI reports as the useless
`WebSocket error: error` (issue #40).

## Change

- `cdp launch`-style browser starts pass `--remote-allow-origins=*`.
- On handshake failure, probe `http://<host>:<port>/json/version`: if it answers, name the cause and
  the flag instead of surfacing a bare WebSocket error.
- Add the flag to the "Enable remote debugging" docs, including the manual commands for Chrome on
  macOS/Linux/Windows, with the trust-boundary caveat spelled out.

## Verification

- `node --test test/upstream-fixes.test.mjs` (2 tests: launch args, help text).
- Manual: Chromium 147 base without the flag → new error message; with the flag → `cdp list` works.

No new dependencies, Node 22+ unchanged.
```

### PR B（#24，独立可合并）

文件：`docs/traffic/pr-24.body.md`

```markdown
## Problem

Issue #24: drag interactions on a canvas (three.js, fabric.js, Excalidraw) do nothing, because
`clickxy` only sends moved → pressed → released.

## Change

New `drag <target> <x1> <y1> <x2> <y2> [steps]` command next to `clickxy`:

- `mouseMoved` (buttons 0) → `mousePressed` (buttons 1) → `steps` interpolated `mouseMoved`
  (buttons 1) → `mouseReleased` (buttons 0);
- `steps` defaults to 10, capped at 50;
- CSS pixels, same DPR rule as `clickxy`;
- added to `USAGE`, to the daemon command list, and to `NEEDS_TARGET`.

## Verification

Manual on a three.js orbit scene (rotation now happens), plus a test that the help text documents
the command and the step cap.
```

### PR C（#19，先谈，再提）

文件：`docs/traffic/pr-19.body.md`

```markdown
## Problem

Issue #19: in sandboxes that deny `AF_UNIX` `bind()`, the per-tab daemon fails with
`listen EPERM` and every page command is unusable; `list` still works because it has no daemon.

## Change (opt-in, default untouched)

`CDP_DAEMON_TCP=1` switches the transport to an ephemeral `127.0.0.1` port:

- the daemon publishes `<port>\n<token>` to `<runtime>/cdp-<id>.port` (mode `0600`, `0700` dir);
- every request must carry the token, since TCP has no filesystem permissions to inherit;
- same NDJSON protocol, same idle exit, same consent behaviour, socket path removed on shutdown.

Without the variable, behaviour is byte-for-byte what it is today — no socket path, no transport
change, no new failure mode.

## Why not always TCP

The Unix socket keeps access control in the kernel. TCP is a compatibility switch for environments
that cannot create Unix sockets, not a better default.

## Verification

`npm test` (22 tests). Manual in a sandbox that reproduces `listen EPERM`: `CDP_DAEMON_TCP=1 cdp snap
<TARGET>` returns the accessibility tree; `cdp snap` without the variable still fails with the same
message as today.
```

---

## 3. Show HN

```text
Show HN: chrome-cdp-kit – drive your live Chrome, hand its logins to a clean profile

I kept wanting the same thing from browser agents: use the Chrome I am already logged into, and when
the automation needs to run unattended, hand that session to a separate profile instead of closing
my window or copying a 2 GB profile directory.

Upstream chrome-cdp-skill already solves the first half — raw CDP over WebSocket, one daemon per tab,
so you get one "Allow remote debugging?" prompt per tab and no Puppeteer dependency. I added the
second half on top, without touching its code paths:

- `cdp auth sync --profile DIR` — export cookies (+ localStorage for the origins you name) from the
  live browser, launch a detached browser on a dedicated profile, import, keep the payload in memory.
  The source browser decrypts its own cookies, so App-Bound Encryption never enters the picture.
- `cdp doctor` — show detected browsers/port files, no secrets printed.
- Fixes for three upstream issues: Chromium 128+ `--remote-allow-origins`, canvas `cdp drag`, and an
  opt-in TCP transport for sandboxes where `bind()` on a Unix socket returns EPERM.

No build step, no dependencies beyond Node 22, 22 tests, Ubuntu + Windows CI.

What it deliberately does not do: bypass the "Allow remote debugging" prompt, copy extensions or
history, or defeat device-bound sessions. Those are the boundaries that make the thing honest.

https://github.com/yidasanqian/chrome-cdp-kit

First comment: the messy details — which Chromium versions need the allowlist flag, why the daemon
exists at all, and what still breaks (2FA, WebAuthn-bound sessions, `sessionStorage`/IndexedDB).
```

## 4. X / Twitter 串

```text
1/ Your agent can already read a web page. It cannot use the browser you are logged into.

2/ chrome-cdp-kit drives your live Chrome over raw CDP — no Puppeteer, one prompt per tab — then
   hands that login state to a clean, independent profile:

   cdp auth sync --profile ./cdp-profile --origin https://github.com

3/ Cookies come out of the source browser's own decryption path, so App-Bound Encryption is a
   non-issue. Payload stays in memory; nothing hits disk unless you ask for an export file.

4/ Also fixed, on top of upstream chrome-cdp-skill v1.1.0:
   - Chromium 128+ rejects WS upgrades → clear error + --remote-allow-origins
   - canvas drag → `cdp drag t 100 100 400 300 20`
   - sandboxed EPERM → CDP_DAEMON_TCP=1

5/ 22 tests, Ubuntu + Windows CI, MIT.
   github.com/yidasanqian/chrome-cdp-kit
```

## 5. Reddit（r/ClaudeAI / r/LocalLLaMA）

```text
Title: Giving an agent your logged-in browser without copying the profile

The recurring problem when an agent needs a session it did not create: either you let it attach to
your daily Chrome (one "Allow remote debugging?" prompt per tab, your window stays in the way), or
you copy the whole profile directory (megabytes of junk, encrypted cookies, and Chrome refuses to
launch two instances on one directory anyway).

What worked for me: read the session out of the live browser, launch a detached browser on a
dedicated profile, write the session in.

    cdp auth sync --browser chrome --profile ./cdp-profile --origin https://github.com

Cookies are exported as CDP cookie objects and re-`setCookies`'d, which means the source browser does
the decryption itself — that is why App-Bound Encryption, which broke most cookie-copying tools,
does not matter here. localStorage moves only for the origins you pass explicitly.

The CLI is a fork of chrome-cdp-skill with three upstream issues fixed (Chromium 128+ origin
allowlist, canvas drag, sandboxed Unix-socket EPERM). Repo, tests and the trade-offs are documented:
https://github.com/yidasanqian/chrome-cdp-kit

Caveats I will not paper over: profiles with saved data will still prompt once, 2FA and WebAuthn-bound
sessions may need re-verification, and sessionStorage/IndexedDB are not carried.
```

## 6. V2EX（分享创造）

```text
标题：把浏览器里的登录态交给 agent，不用复制 profile、不用关窗口

做这个是因为每次让 agent 跑需要登录的流程，都要么占着我的 Chrome，要么复制一份 profile 目录
（几十万个小文件，cookie 还是加密的，俩实例又不能共用同一个 user-data-dir）。

现在的做法：从活着的浏览器里把 cookie（以及指定 origin 的 localStorage）读出来，另起一个独立
profile 的浏览器，写进去。

  cdp auth sync --browser chrome --profile ./cdp-profile --origin https://github.com

cookie 是让源浏览器自己解密的（CDP Storage.getCookies），所以 Chrome 的 App-Bound Encryption
不影响；写进去用 Storage.setCookies。全程在内存里，除非你显式 `--out` 导出文件。

顺带把上游三个 issue 修了：Chromium 128+ 的 --remote-allow-origins、canvas 拖拽 `cdp drag`、
沙箱里 Unix socket bind 报 EPERM 时的 `CDP_DAEMON_TCP=1`。

22 个测试，Ubuntu + Windows CI，Node 22+，无运行时依赖，MIT：
https://github.com/yidasanqian/chrome-cdp-kit

做不到的部分我也写在 README 里：有数据的 profile 该弹的「允许远程调试」还是会弹，2FA/WebAuthn
绑定的会话可能还要重新验证，sessionStorage 和 IndexedDB 不搬。
```

## 7. 掘金长文大纲

1. 场景：一个必须登录才能跑通的自动化流程（附失败截图）。
2. 三条常见死路：占着日常窗口 / 复制 profile / 用 Shadow DOM 硬造假登录。
3. 原理：CDP 传输层、`Storage.getCookies` 与 `Network.setCookies`、App-Bound Encryption 为什么在这里失效、cookie 的 `partitionKey` 为什么必须保留。
4. 跑通：`cdp doctor` → `cdp auth sync` → 新窗口打印用户名（附终端输出）。
5. 边界：一次「允许远程调试」、2FA、sessionStorage、设备指纹。
6. 上游三个 issue 的修法（贴 `docs/UPSTREAM-FIXES.md` 的片段）。
7. 结尾：仓库链接 + 自己踩的坑（沙箱 EPERM 那段最容易被收藏）。