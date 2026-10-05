import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MagicString, { Bundle } from 'magic-string';

const WORLD = fileURLToPath(new URL('./src/world/', import.meta.url));
const ID = 'virtual:samay-world', RID = '\0' + ID;

// The world is a set of numbered scripts (10_core … 99_main) that share one scope, layered like a painting.
// This plugin joins them, in order, into a single module, with a source map so errors and breakpoints
// point at the real file and line. Saving any of them reloads the page.
function samayWorld() {
  const files = () => fs.readdirSync(WORLD).filter((f) => f.endsWith('.js')).sort();
  return {
    name: 'samay-world',
    resolveId(id) { if (id === ID) return RID; },
    load(id) {
      if (id !== RID) return;
      const bundle = new Bundle();
      for (const f of files()) {
        const file = path.join(WORLD, f);
        this.addWatchFile(file);
        bundle.addSource({ filename: file, content: new MagicString(fs.readFileSync(file, 'utf8') + '\n') });
      }
      return { code: bundle.toString(), map: bundle.generateMap({ hires: true, includeContent: true }) };
    },
    configureServer(server) {
      const reload = (file) => {
        if (!path.resolve(file).startsWith(WORLD)) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(WORLD);
      server.watcher.on('change', reload); server.watcher.on('add', reload); server.watcher.on('unlink', reload);
    },
  };
}

export default defineConfig({
  base: './',                       // relative paths: works at user.github.io/<repo>/, on a custom domain, or any static host
  plugins: [samayWorld()],
  build: { chunkSizeWarningLimit: 2500 },
  optimizeDeps: { include: ['meshoptimizer/simplifier'] },   // loaded on demand by the scan LOD; pre-bundled so the dev server doesn't reload mid-session
  server: { open: true },
});
