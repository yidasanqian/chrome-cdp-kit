Same problem: `clickxy` dispatches moved/pressed/released, which most canvas libraries ignore —
three.js `OrbitControls`, fabric.js and Excalidraw all need intermediate `mouseMoved` events with
`buttons: 1` between press and release to enter their drag state.

Working command in my tree:

```bash
cdp drag <TARGET> <x1> <y1> <x2> <y2> [steps]   # default 10 steps, capped at 50
```

It sends `mouseMoved` (0) → `mousePressed` (1) → N interpolated `mouseMoved` (1) → `mouseReleased`,
all CSS pixels, so the same `CSS px = shot px / DPR` rule as `clickxy` applies.

Verified on a headless Chrome canvas listening for the three events: `drag 100 120 500 420 20` gave
down=1, move=21, up=1, `buttons=[1]`, start=[100,120], end=[500,420] — so the intermediate moves are
real, not a press/release pair with one jump.

Implementation is ~15 lines next to `clickXyStr` in `cdp.mjs`; test asserts the help text and the
step cap. https://github.com/yidasanqian/chrome-cdp-kit — `docs/UPSTREAM-FIXES.md` section #24.
```

### issue #19（sandbox EPERM）
