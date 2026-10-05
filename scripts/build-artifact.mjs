// Build a single self-contained page (for a Claude artifact, or any host that wants one HTML file).
// three.js loads from jsDelivr through an import map; the markup, styles and world code are inline.
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<link rel="icon"[^>]*>\s*/i, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script type="module" src="[^"]*"><\/script>\s*/, '');
const dir = new URL('src/world/', root);
const js = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
const v = JSON.parse(fs.readFileSync(new URL('node_modules/three/package.json', root), 'utf8')).version;
const mv = JSON.parse(fs.readFileSync(new URL('node_modules/meshoptimizer/package.json', root), 'utf8')).version;
const imap = `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${v}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${v}/examples/jsm/","meshoptimizer/simplifier":"https://cdn.jsdelivr.net/npm/meshoptimizer@${mv}/meshopt_simplifier.js"}}</script>`;   // meshoptimizer 1.x resolves its subpaths through package "exports", which a CDN does not, so the one file used is named outright
const page = `${head.trim()}\n${body.trim()}\n${imap}\n<script type="module">\n${js}\n</script>\n`;
fs.mkdirSync(new URL('dist-artifact/', root), { recursive: true });
fs.writeFileSync(new URL('dist-artifact/samay-chakra.html', root), page);
console.log(`dist-artifact/samay-chakra.html  ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`);
