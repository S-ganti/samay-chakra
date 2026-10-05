---
name: browseros-neo-test
description: Test the Samay Chakra site (live or local) in the user's BrowserOS "neo" browser, which has the real GPU. Use when asked to check that the world renders, to reproduce a WebGL or "graphics lost" problem, to measure frame rate on the user's machine, or to confirm a fix on Medium or High quality. The cloud sandbox only has software GL, so it cannot show real-GPU behaviour.
---

# Testing Samay Chakra in BrowserOS neo

The cloud sandbox renders with SwiftShader (software). It proves logic, errors and pixel output, but **cannot reproduce GPU resets, TDR timeouts or real fps**. BrowserOS neo runs on the user's real GPU, so it is the place to confirm anything about speed or "WebGL lost / needs WebGL" failures.

## 0. Before anything: map the tools
This skill names the checks, not BrowserOS's tool names (they were not visible when it was written). First list the browser tools available this session and map them to the five things needed: **navigate to a URL**, **run JavaScript in the page and return the result**, **read console messages**, **take a screenshot**, **open/close tabs**. If any of the five is missing, say so and use the closest substitute instead of guessing.

## 1. Safety rules (a GPU crash can lock WebGL for the whole browser)
- One tier at a time, **Low first**, then Medium, then High. Never reload in a loop.
- Earlier tests in this browser caused 8 GPU crashes and Chrome switched WebGL off until it was restarted. If the page shows **"This world needs WebGL…"**, stop. Tell the user to quit BrowserOS completely and reopen it (and press Win+Ctrl+Shift+B), then continue.
- Between tests, clear the page's remembered state so a previous run cannot steer the next one:
  `localStorage.removeItem('samay.boot'); localStorage.removeItem('samay.safe'); localStorage.removeItem('samay.quality'); sessionStorage.clear()` (or open with `?safe=0`).
- Use a fresh tab per tier. Close it afterwards.

## 2. Record the machine first
Open the browser's GPU page (`chrome://gpu`, or the BrowserOS equivalent) and note the **WebGL** and **WebGL2** lines (want "Hardware accelerated"), the GPU name, and the driver date. If WebGL is software-only or disabled, the page is not at fault: report that and stop.

## 3. Per-tier run
URL: `https://s-ganti.github.io/samay-chakra/?q=low` (then `med`, `high`). For a local build, use the dev-server URL instead.
1. Navigate, wait up to 60 s for `window.__samay && __samay.UI.started === true`.
2. Read the start-up log. It is on the page as console lines starting `[samay]`, and in the Controls panel under **Diagnostics**. The stages, in order, are: `world built`, `shaders warmed`, `post-warm ok`, `scans ready`, `scan-compile ok`, `scan-colour ok`, `scan-shadow ok`, `scans warmed`, `frame 1 ok`, `frame 2 ok`, `frame 3 ok`, `first frame`.
   - **`graphics lost during: <stage>`** names the stage that killed the context. That is the key finding: report it verbatim.
   - A start that lost the graphics restarts itself without shadows (safe level 1), then at Low (level 2), and shows a toast saying so. Note which level the page ended on: `__samay` does not expose it, but `JSON.parse(localStorage.getItem('samay.safe')||'null')` does.
3. Screenshot the scene after 5 s.
4. Measure speed (run in the page, takes 5 s):
   ```js
   (async()=>{const s=__samay;let n=0,t=performance.now();await new Promise(r=>{const f=()=>{n++;performance.now()-t<5000?requestAnimationFrame(f):r()};requestAnimationFrame(f)});console.log((n/5).toFixed(1)+' fps, render scale '+s.DR.rs.toFixed(2)+', quality '+s.PARAM.quality+', scan kTris '+Math.round(s.CULL.tris/1e3)+' + shadow '+Math.round(s.CULL.shadowTris/1e3)+', draw calls '+s.renderer.info.render.calls)})()
   ```
   Note the render scale: the page lowers it by itself when frames are slow, so fps alone is misleading. A scale pinned near 0.55 with fps below 40 means the GPU, not the pixel count, is the limit.
5. Collect errors: anything in the console at level error, plus `__samay.UI.errN` and `__samay.UI.nanN` (both should be undefined/0).

## 4. If a tier fails, bisect with the link switches
Add to the URL, one at a time, on a fresh browser state: `&off=shadows`, `&off=scans`, `&off=grass`, `&off=post` (comma-separate to combine). Report which switch makes the tier start. `?safe=0` clears a remembered fallback.

## 5. Report back
A short table: tier, started yes/no, last stage reached, `graphics lost during`, fps and render scale, console errors, screenshot taken. Add the GPU/driver line from step 2. Say plainly what was **not** tested. Do not claim a fix works on the user's machine unless a Medium or High run reached `frame 3 ok` with no loss here.
