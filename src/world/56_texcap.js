/* =========================================================================
   TEXCAP — a texel budget for the photographed textures.
   The scans and stone surfaces ship at 1024–2048 px, and every one lands on the GPU as RGBA with a full mip chain
   (a 2048 px texture is 21 MB, the nine stone-detail maps alone are 192 MB). Most of that is wasted: the stone
   maps repeat every 2 m, so even 1024 px is ~500 texels per metre against ~50 pixels per metre on screen.
   Each quality tier names the longest edge it will keep (QUAL[...].cap); textures are shrunk once, as they load and
   before their first upload, so the GPU never sees the large version and the browser's copy is freed.
   ========================================================================= */
const TEXCAP = { n: 0, savedMB: 0, jobs: new WeakMap() };
const texEdge = (kind) => { const q = QUAL[PARAM.quality]; return (q && q.cap && q.cap[kind]) || 0; };
const _imSize = (im) => im ? [im.naturalWidth || im.width || 0, im.naturalHeight || im.height || 0] : [0, 0];

// shrink one texture's image so its long edge is at most `max` texels. Resolves true when it was resized.
// Textures that share an image (cloned materials) are shrunk once.
function capTexture(t, max) {
  if (!t || !t.isTexture || !max || t.isCompressedTexture || t.isDataTexture || t.isCanvasTexture || t.isRenderTargetTexture) return Promise.resolve(false);
  const src = t.source; if (src && TEXCAP.jobs.has(src)) return TEXCAP.jobs.get(src).then(() => false);
  const im = t.image, [w, h] = _imSize(im), k = Math.max(w, h) / max;
  if (!(k > 1.01)) return Promise.resolve(false);
  const nw = Math.max(1, Math.round(w / k)), nh = Math.max(1, Math.round(h / k));
  const job = (async () => {
    let out = null;
    // glTF textures arrive as ImageBitmaps (decoded without premultiplication or colour conversion, orientation already settled): resize them the same way
    try { if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) out = await createImageBitmap(im, { resizeWidth: nw, resizeHeight: nh, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch (e) { out = null; }
    if (!out) {      // plain images (TextureLoader) and browsers without bitmap resizing: draw them smaller; the texture's own flipY still applies at upload
      try { const c = document.createElement('canvas'); c.width = nw; c.height = nh; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, nw, nh); out = c; } catch (e) { return false; }
    }
    t.image = out;
    t.dispose();                    // if it had been uploaded already, make the next use allocate at the new size
    t.needsUpdate = true;
    if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) try { im.close(); } catch (e) { }
    TEXCAP.n++; TEXCAP.savedMB += (w * h - nw * nh) * 4 * (t.generateMipmaps ? 1.333 : 1) / 1048576;
    return true;
  })();
  if (src) TEXCAP.jobs.set(src, job);
  return job;
}
// every texture a material holds
function capMaterial(m, max) {
  const jobs = []; if (!m || !max) return jobs;
  for (const key in m) { const v = m[key]; if (v && v.isTexture) jobs.push(capTexture(v, max)); }
  return jobs;
}
// the [geometry, material] pairs of a loaded scan
const capParts = (parts, max) => Promise.all(parts.flatMap(([, m]) => capMaterial(m, max)));
