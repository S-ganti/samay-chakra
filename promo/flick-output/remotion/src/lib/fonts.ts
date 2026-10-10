import {continueRender, delayRender, staticFile} from 'remotion';
import faces from './fonts.json';

// The site's Google Fonts, vendored into public/fonts (the render sandbox can't reach Google Fonts over TLS).
// Only the subsets the film uses: latin(+ext) and each prahar's native script.
let loaded = false;
export const loadSiteFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('Loading site fonts');
  Promise.all(
    (faces as {family: string; weight: string; file: string; unicodeRange: string}[]).map((f) => {
      const face = new FontFace(f.family, `url(${staticFile('fonts/' + f.file)}) format('woff2')`, {
        weight: f.weight, unicodeRange: f.unicodeRange, display: 'block',
      });
      document.fonts.add(face);
      return face.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => { console.error(e); continueRender(handle); });
};
