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
