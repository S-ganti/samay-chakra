# Remotion Composition Brief: Flick (Samay Chakra teaser)

## Objective
Create the approved short-form scene animations from the timestamped transcript (`transcript.json`), for a 9:16 and a 16:9 cut.

## Output
- Remotion project: `remotion/`
- Formats:
  - 9:16: 1080×1920 at 30 fps (composition `<id>-v`)
  - 16:9: 1920×1080 at 30 fps (composition `<id>-h`)
- Rendered scenes: `scenes/<id>-v/<id>-v.mp4` and `scenes/<id>-h/<id>-h.mp4` for every scene in `scene-spec.json`. `carved-stone` is 16:9 only.

## Source Material
- Transcript: `transcript.json`. `segments` holds the 9:16 timing; `segments_16x9` holds the 16:9 timing.
- Approved plan: `flick-plan.md`. Each scene's "What's on screen", "Sequential" and "Transition" sections are the spec.
- Brand assets: `brand-assets/ring-logo.svg`, fonts vendored in `remotion/public/fonts/`, and the site palette in `remotion/src/lib/tokens.ts`.
- Footage captured from the real site: `remotion/public/footage/`, symlinked to `promo/footage/`. Each clip is listed in `promo/footage/manifest.json`.
- Sound effects: `remotion/public/sounds/`.

## Creative Direction
- **User direction:** "clean fluid artistic motion graphics in the style of the whole website", built from snippets of the actual website.
- **Interpretation:**
  - Real footage carries every scene.
  - Graphics are thin and typographic, like the site's own UI: hairlines, wide-tracked Jost caps, Cinzel statements, native script in the chapter colour, and the ring motif.
  - One easing family (`lib/motion.ts`), soft out with no overshoot.
  - The corner progress dial (`lib/CornerDial.tsx`) sits in one fixed position across scenes 5–13 and 16.
- **Avoid:**
  - Generic filler, gradients that aren't from the site, bouncy springs, emoji, stock icons.
  - Background music inside scenes. The raga bed is added at assembly.
  - Text in the 9:16 platform-UI zones: the bottom 22% and the right 14% (`useFormat().safe`).

## Scene Compositions
The per-scene detail is in `flick-plan.md`, under the scene heading with the same id. IDs, timing, assets and SFX are in `scene-spec.json`.

| id | Component | 9:16 frames | 16:9 frames |
|---|---|---|---|
| hook-not-a-game | HookNotAGame | 42 | 48 |
| hook-its-a-clock | HookItsAClock | 54 | 60 |
| eight-prahars-ring | EightPraharsRing | 99 | 120 |
| raga-light-crowd | RagaLightCrowd | 90 | 120 |
| i-built-all-eight | IBuiltAllEight | 30 | 42 |
| prahar-enter … prahar-return (8) | PraharEnter … PraharReturn (one shared `PraharCard` with a chapter prop) | 105 each | 165 each |
| pick-a-style | PickAStyle | 225 | 270 |
| carved-stone | CarvedStone | — | 150 |
| real-sky | RealSky | 180 | 240 |
| runs-in-browser | RunsInBrowser | 150 | 180 |
| which-prahar-are-you | WhichPraharAreYou | 150 | 210 |

## Remotion Instructions
- Build one dedicated component per approved scene under `src/scenes/`.
- Register it by adding `{id, component}` to that builder's group file (`groupA.ts`, `groupB.ts` or `groupC.ts`). `Root.tsx` turns each entry into its independent `-v` and `-h` Compositions, with durations derived from the transcript. Do not create an all-scenes composition.
- Use frame-driven motion only (`useCurrentFrame`, `interpolate`, and the `lib/motion.ts` helpers). No CSS animations or transitions.
- Use the shared library (`lib/tokens.ts`, `lib/Type.tsx`, `lib/Footage.tsx`, `lib/RingDial.tsx`, `lib/CornerDial.tsx`, `lib/format.ts`) so the scenes read as one film.
- Each scene lays itself out for both formats with `useFormat()`.
- Use SFX only as listed in `scene-spec.json`, via `<Audio src={staticFile('sounds/…')} volume={…}/>` inside a `<Sequence from={…}>`.
- Keep on-screen text readable: at least 0.3 s per word, at least 0.8 s for a label.
- Render every scene before review.
