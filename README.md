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

- `?q=high`, `?q=med` or `?q=low` opens at that render quality, for example
  `https://YOUR-USERNAME.github.io/samay-chakra/?q=high`.
- A quality picked in the Controls panel is remembered on that device and is never lowered automatically.
  Changing it rebuilds the world (grass, tree density, carving detail and texture sizes are made once at load).

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
| `40_city.js`, `42_trees.js`, `44_temple.js`, `45_decor.js`, `46_grass.js` | City and plaza, trees, the Sun Temple, garlands and lamps, grass |
| `47_rigdata.js`, `48_crowd.js`, `50_people.js` | The crowd: baked motion-capture rig, GPU skinning, behaviour and dance |
| `58_light.js`, `60_sky.js`, `70_post.js`, `72_palette.js` | Lighting, sky and atmosphere, post-processing, the pigment palettes |
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
- Everything else (world, carving, music and sound) is generated in code.

No license has been chosen for this project's own code yet, so by default all rights are reserved.
Add a `LICENSE` file if you want others to reuse it.
