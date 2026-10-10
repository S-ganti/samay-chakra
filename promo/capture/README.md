# Samay Chakra: raw footage capture

Deterministic frame-by-frame capture of the built site (`dist/`, served by `vite preview`) with Playwright + Chromium on
software GL (SwiftShader). Nothing in `src/` or `index.html` is touched.

## How it works
* `lib.mjs`: launches Chromium (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`), sets
  `window.__fixedDt = 1/30` before load (one frame = exactly 1/30 s, adaptive resolution off), waits for `__samay.UI.started`,
  then stops the page's own `requestAnimationFrame` loop. Frames are produced by calling `__samay.step(1000/30)` and
  reading the WebGL canvas back with `gl.readPixels` in the same task (the drawing buffer is not preserved), streaming raw RGBA
  to `ffmpeg` (`vflip`, libx264 CRF 14, yuv420p). No PNG round trip.
* `window.__H` (injected by `lib.mjs`): `reset()` puts the world in a reproducible state (hour, `S.rt`, beat clock, camera spring),
  locks the camera director to one shot index (`PARAM.shotLen = 1e6` plus `CAM.chapterRt`), or takes a hand-built camera via
  orbit mode (`PARAM.camera = 'orbit'`, position/target/fov set per frame, optionally by a small function of the frame number).
  Warm-up = 120 simulated frames with the draw call skipped (crowd, weather, camera settle; ~4 ms each) + 6 fully rendered frames
  (TAA history, shadows) with time frozen; the clock then runs from the requested hour on the first recorded frame.
* `Date.now` is pinned to a full-moon date (2026-10-26) so the moon is bright and identical in every clip.
* `clips.mjs`: every clip spec (hour, shot/camera, weather, style, frame count). `CLIPS` are rendered at true 30 fps (`capture.mjs`);
  `HALF` clips are rendered at 15 fps and motion-interpolated to 30 fps (`capture2.mjs`, ffmpeg `minterpolate`) to save time.
* `ui.mjs`: native-viewport (1080x1920 and 1920x1080) screenshots of the real interface (`page.screenshot`) and the dial
  time-travel clip. Timers and CSS animations are driven by simulated frame time so the card/dial animations are smooth.
* `build_manifest.mjs`: ffprobe + capture metadata + `footage/notes.json` -> `footage/manifest.json` and `contact_sheet.jpg`.
* `scout.mjs`, `scout2.mjs`: one-frame look-development of every director shot / custom camera (used to pick shots).
* `probe*.mjs`: timing probes.

## Run
```
cd /home/user/samay-chakra && npx vite preview --port 4173 --strictPort &      # serves dist/
cd promo/capture && npm i playwright@1.56.1                                     # matches chromium-1194 in /opt/pw-browsers
node capture.mjs 1280 med s01_timelapse_day,s03_gathering      # true 30 fps clips
node capture2.mjs 1280 med s11_style_real,s11_style_sumi       # 15 fps + interpolation clips
node ui.mjs v ; node ui.mjs h                                   # UI stills + dial scrub clips
node build_manifest.mjs
```
Env: `SAMAY_URL` (default `http://localhost:4173/`), `CHROME_PATH`, `INTERP=mci|blend`.

## Cost
~3.5-4.5 s per frame at 1280x1280 on 4 cores, almost independent of resolution (the scene is geometry-bound: shadow, depth and
colour passes), and parallel browsers do not add throughput (CPU saturated).
