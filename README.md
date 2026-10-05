# The Ring · Samay Chakra

A living 3D world of eight *prahars*: the day turns through eight chapters, each drawn from a poster. There's
carved sandstone, granite and marble, a crowd that dances on the beat, a generative raga engine, the real moon
phase, weather that follows Bengaluru's seasons, and the sounds of each hour.

**Live:** <https://s-ganti.github.io/samay-chakra/> (add `?q=high` on a strong GPU, `?q=low` on older machines)

It is a static web app (three.js + Vite). No server, no build secrets: anything that serves files can host it.

---

## Run it on your computer

1. Install **Node.js 20.19 or newer** (22 LTS is best) from <https://nodejs.org> and **Git** from <https://git-scm.com>.
2. Open a terminal in this folder and install the dependencies (once):
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
   Your browser opens at `http://localhost:5173`. Every time you save a file in `src/world/` or `index.html`,
   the page reloads with your change.
4. To check the production build locally:
   ```sh
   npm run build      # writes dist/
   npm run preview    # serves dist/ at http://localhost:4173
   ```

## Put it online (GitHub Pages, free)

The repository already contains `.github/workflows/deploy.yml`, which builds the site and publishes it every
time you push to `main`.

1. On github.com, create a **new empty repository** (for example `samay-chakra`). Leave the "Add a README",
   ".gitignore" and "license" boxes **unchecked**. It must be **public** on a free account (GitHub Pages for
   private repositories needs a paid plan).
2. In this folder, connect it and push (replace `YOUR-USERNAME`):
   ```sh
   git remote add origin https://github.com/YOUR-USERNAME/samay-chakra.git
   git push -u origin main
   ```
   Git will ask you to sign in the first time (a browser window, or GitHub Desktop / the GitHub CLI if you use them).
3. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open the **Actions** tab and wait for "Deploy static content to Pages" to finish (about a minute).
   Your site is live at `https://YOUR-USERNAME.github.io/samay-chakra/`.
5. From now on: edit, `git add -A`, `git commit -m "what changed"`, `git push`, and the site updates itself.

A custom domain (for example `samaychakra.art`) can be added later under **Settings → Pages → Custom domain**.

## Share links

- `?style=fusion` opens in the **Fusion Series** style: each chapter drawn as its poster's pairing of an Indian folk tradition and a modern movement (Gond × Art Deco, Warli × Op Art, Thangka × Suprematism, Madhubani × Star Atlas, Kalighat × Pop Art, Truck Art × Swiss Style, Pattachitra × Memphis, Kolam × Generative Code): ink outlines, flat bands of the design language's named pigments, and the poster's texture in the shade. Medium and High only; also under Controls → Render style, or the **Y** key.
- Three more render styles, each one cohesive concept (`src/world/75_styles.js`), also Medium and High only:
  - `?style=sumi`: **Sumi & Shu**, ink wash on rice paper after Hasegawa Tōhaku's *Pine Trees*, Sesshū and *Ōkami*; distance dissolves into mist, a pressure-varied brush line, and only vermilion survives (fire, lamps, sindoor), Kurosawa-style. Signed with a red hanko seal bearing the ring.
  - `?style=neon`: **Chungking Neon**, after Christopher Doyle and Wong Kar-wai, *Blade Runner 2049* and *Akira*: the chapter's colour owns the frame against one counter colour, step-printed motion smear, film halation, anamorphic streaks, 2.39:1 scope bars, heavy grain.
  - `?style=paint`: **Painted Light**, after Kazuo Oga's Ghibli backgrounds, Makoto Shinkai's light, Monet and Van Gogh, and *Arcane*: brush strokes that follow the forms, blue-violet shade instead of black, warm saturated light, thin wobbling coloured outlines, canvas weave.
  The **Y** key cycles through all five styles.
- `?q=high`, `?q=med` or `?q=low` opens at that render quality, for example
  `https://YOUR-USERNAME.github.io/samay-chakra/?q=high`.
- A quality picked in the Controls panel is remembered on that device and is never lowered automatically.
  Changing it rebuilds the world (grass, tree density, carving detail and texture sizes are made once at load).

## Defaults and performance

- The page opens on **Medium**, a day in **8 minutes**, population **180**, realism **2**, film grain **0**, the **raw render** (no pigment palette), sounds of the hour **30%**, shot length **8 s** and crowd energy **1.6**. All of them are in the Controls panel (and in `PARAM` in `src/world/10_core.js`).
- Each quality draws the picture at a fixed pixel budget (`mp` in `QUAL`, `src/world/99_main.js`: Low 0.8, Medium 1.5, High 4 megapixels). On Medium and High a **temporal upscaler** (`TaaPass`, `src/world/70_post.js`) turns that into a full-resolution picture: the camera is nudged by a sub-pixel Halton offset every frame, last frame's full-resolution image is reprojected (depth and the previous view) and kept where it agrees with the new frame's neighbourhood and the same surface is still there (a depth test catches dancers and vehicles, which have no motion vectors), so each screen pixel gathers many samples over a few frames; pixels without usable history fall back to FXAA and a Catmull-Rom upscale. Grass, leaf edges and wires stop shimmering, and flat areas settle into calm "clustered" patches (`uCluster`, by render style) before a contrast-adaptive sharpen. Low keeps the spatial Catmull-Rom upscale. A frame-time controller trims the budget in small steps if the display's refresh interval is being missed; the temporal pass keeps full-resolution history, so the steps don't show.
- Scanned meshes are culled per instance (camera view and shadow box) and drawn at a level of detail that matches their size on screen (`src/world/57_cull.js`). Each simplified level is built once at load with [meshoptimizer](https://github.com/zeux/meshoptimizer) (down to about 3% of a scan's triangles, sharing the full mesh's vertex buffers) and is used only while it meets both limits in `QUAL`: `dens` (square pixels per triangle) and `errPx` (how far, in pixels, it may sit from the real surface). Shadow casters are drawn into the shadow map from their own copies, chosen by what the shadow map can resolve (`errTexels` in `CULL`) rather than by the camera, which is where most of the triangles used to go. Edges are antialiased by the temporal pass (FXAA on Medium and SMAA on High remain as fallbacks when it is off).
- The 2048 px stone, cliff and temple textures, and the ground textures, are resampled on Medium and Low to cut texture memory (`TEXCAP` in `src/world/43_scans.js`); High keeps them at full size.
- Wind is one gust field for the whole landscape (`WIND_GLSL`, `src/world/42_trees.js`): gusts roll across the grass and on into the trees. The director's camera moves on a critically damped spring, and people keep a little personal space (`avoidance`, `src/world/50_people.js`).
- If the browser drops the graphics context and does not restore it, the page restarts once, one quality step lower.
- Start-up is checked stage by stage (the log lists `post-warm`, `scan-compile`, `scan-colour`, `scan-shadow`, `frame 1-3`). If the graphics are lost during a stage, the next start runs the same quality **without shadows**, and if that fails too, at Low; a toast says so. Add `?safe=0` to the link to forget it. To find what a machine can't draw, add `?off=shadows`, `?off=scans`, `?off=grass` or `?off=post` (comma-separate to combine).
- To see the numbers, in the browser console: `__samay.CULL` (pieces and triangles drawn), `__samay.renderer.info` (draw calls, texture count) and `__samay.DR.rs` (the current render scale).

## How the code is organised

`index.html` holds the page: markup, styles and the interface. The world itself lives in `src/world/` as numbered
scripts that **share one scope**, like layers of a painting. The `samay-world` plugin in `vite.config.js` joins
them in order into one module (with a source map, so the browser's devtools show the real file and line).
Anything declared in a lower number is visible to the higher ones.

| File | What it does |
|---|---|
| `10_core.js` | Maths helpers, the eight chapters, each chapter's **look** (colours, fog, light), user parameters |
| `20_terrain.js` | Ground, hills, the plateau, the ridge; `groundY()` height lookups |
| `25_textures.js` | Canvas-painted textures (flagstones, banners, moon, signage) |
| `26_carve.js` | **Carving**: sculpted figures and motifs turned into normal, albedo and roughness maps, in background workers |
| `30_structures.js` | The ring stage, the portal wheel, towers, steps, Diamond Ring arches, the eclipse ring |
| `40_city.js`, `42_trees.js`, `44_temple.js`, `45_decor.js`, `46_grass.js` | City and plaza (weathered facades, asphalt, paving and shutters in `SURF_GLSL`), trees (leaf and bark textures; Bengaluru's flowering street trees bloom by today's month in `BLOOMS`), the Sun Temple, garlands and lamps, grass (green and straw patches, seed heads, wildflowers) |
| `47_rigdata.js`, `48_crowd.js`, `50_people.js` | The crowd: baked motion-capture rig, GPU skinning, behaviour and dance. Seven outfits (saree, lehenga, salwar kameez, kurta, dhoti or lungi, and city shirts, tees, kurtis and jeans), dressed from whole combinations in `OUTFITS` with woven and printed cloth (`CROWD_FABRIC_FS`: stripes, checks, bandhani, block print, ikat, denim, heathered cotton, silk and zari sheen) |
| `57_cull.js` | Per-frame culling and distance LOD for the scanned rocks and temple pieces (and the shadow map's share of them) |
| `58_light.js`, `60_sky.js`, `70_post.js`, `72_palette.js` | Lighting, sky and atmosphere, post-processing, the pigment palettes |
| `73_fusion.js` | The Fusion Series render style: per-chapter pigment ramps, ink, and poster textures (`FUSION`) |
| `75_styles.js` | Sumi & Shu, Chungking Neon and Painted Light render styles (`STYLES`, `NEON_PAIRS`) |
| `74_nature.js` | Moon phase, Bengaluru weather, rain, birds, fireflies |
| `80_audio.js`, `82_ambience.js` | Generative raga engine, the sounds of each hour |
| `90_camera.js` | The director: shots for each chapter |
| `95_ui.js`, `99_main.js` | Interface, capture (stills, video, poster postcards), boot and the frame loop |

Useful starting points: change a chapter's colours in `LOOKS` (`10_core.js`), a palette in `72_palette.js`,
camera shots in `SHOTS` (`90_camera.js`), carving designs in the `SHEETS` inside `carveLib()` (`26_carve.js`).

In the browser console, `window.__samay` exposes the scene, parameters and systems for poking around.

## Other builds and tools

- `npm run build:artifact` writes `dist-artifact/samay-chakra.html`, a single self-contained page (three.js from
  jsDelivr) for a Claude artifact or any host that wants one file.
- `npm run bake:rig` rebuilds `src/world/47_rigdata.js` from the Quaternius animation library in `tools/rig/`.

## Other hosts

The same repository works on **Cloudflare Pages**, **Netlify** or **Vercel**: import the GitHub repo and use
build command `npm run build`, output folder `dist`. Choose one of those if traffic outgrows GitHub Pages'
soft limit of 100 GB a month.

## Credits

- Motion capture: [Universal Animation Library](https://quaternius.com) by Quaternius (CC0).
- 3D engine: [three.js](https://threejs.org) (MIT).
- Fonts: Cinzel, Jost, Big Shoulders Stencil and Noto scripts from Google Fonts (SIL Open Font License).
- Photogrammetry scans and ground textures: [Poly Haven](https://polyhaven.com) (CC0): granite boulders and cliffs (Namaqualand, mountainside, rock faces), mossy rock beds, stumps and trunks, jacaranda, island tree, searsia, a stone fire pit; forest leaves, red laterite, dry granite, sparse grass and aerial rock textures. Optimised with [glTF-Transform](https://gltf-transform.dev) into `public/scans/`.
- Temple photogrammetry by Akhanda Setu ([gputhige](https://sketchfab.com/gputhige) on Sketchfab), licensed CC BY 4.0, simplified and re-textured for the web:
  - "Free - 3D Scan - 12th Century Bhumija Shikara" (https://sketchfab.com/3d-models/free-3d-scan-12th-century-bhumija-shikara-da50bd1451e24c5f80c9e48f8bd5ff29): the gate shikharas
  - "Free 3DScan 9th Century Pillar" (https://sketchfab.com/3d-models/free-3dscan-9th-century-pillar-f16d9708a3d84c0d8c36376dc176a9af): the stone circle
  - "Free - 3D Scan of 9th Century Temple Outer Wall" (https://sketchfab.com/3d-models/free-3d-scan-of-9th-century-temple-outer-wall-7ad2f66af45544deaa9465b678bc9f56): the ridge ruins
  - "Free - 3D Scan of 6the Century carved platform" (https://sketchfab.com/3d-models/free-3d-scan-of-6the-century-carved-platform-8e5cac3a04ef4c6d8b975bf8c8796b9a): the ring stage frieze
- Stone surfaces on the carved structures: Poly Haven scans (CC0) of sandstone, marble and granite.
- Everything else (world, carving, music and sound) is generated in code.

No license has been chosen for this project's own code yet, so by default all rights are reserved.
Add a `LICENSE` file if you want others to reuse it.
