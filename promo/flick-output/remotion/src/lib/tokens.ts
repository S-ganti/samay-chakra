// Design tokens lifted from the site (index.html :root and src/world/10_core.js CHAPTERS).
import {loadSiteFonts} from './fonts';

loadSiteFonts();

export const FONT = {
  disp: "'Cinzel', Georgia, serif",
  sans: "'Jost', system-ui, sans-serif",
  sten: "'Big Shoulders Stencil', 'Jost', sans-serif",
  dot: "'Doto', 'JetBrains Mono', monospace",
  mono: "'JetBrains Mono', monospace",
  native: "'Noto Sans Devanagari', 'Noto Nastaliq Urdu', 'Noto Serif Tibetan', 'Noto Sans Malayalam', 'Noto Sans Bengali', 'Noto Sans Kannada', 'Noto Sans Oriya', 'Noto Sans Tamil', sans-serif",
};

export const C = {
  ink: '#0f0d0b',
  ink2: '#181512',
  bone: '#ede3d1',
  bone2: 'rgba(237,227,209,.66)',
  bone3: 'rgba(237,227,209,.40)',
  hair: 'rgba(237,227,209,.16)',
  hair2: 'rgba(237,227,209,.28)',
  ember: '#ff7a2f',
  sindoor: '#d8342b',
};

export type ChapterFont = 'disp' | 'sans' | 'sten';
export type Chapter = {
  id: string; n: number; start: number; title: string; native: string; lang: string;
  raga: string; font: ChapterFont; key: string; footage: string;
};

// Clockwise from dusk, as on the site's dial.
export const CHAPTERS: Chapter[] = [
  {id: 'enter', n: 1, start: 18, title: 'Enter the Ring', native: 'प्रवेश', lang: 'hi', raga: 'Yaman', font: 'sans', key: '#ff8a3d', footage: 's02_enter'},
  {id: 'gathering', n: 2, start: 21, title: 'The Gathering', native: 'محفل', lang: 'ur', raga: 'Bihag', font: 'disp', key: '#e0332a', footage: 's03_gathering'},
  {id: 'eclipse', n: 3, start: 0, title: 'Eclipse', native: 'གཟའ་འཛིན', lang: 'bo', raga: 'Malkauns', font: 'disp', key: '#ff3d9a', footage: 's04_eclipse'},
  {id: 'brahma', n: 4, start: 3, title: 'Brahma Muhurta', native: 'ബ്രഹ്മമുഹൂർത്തം', lang: 'ml', raga: 'Lalit', font: 'sans', key: '#7fa2e6', footage: 's05_brahma'},
  {id: 'diamond', n: 5, start: 6, title: 'Diamond Ring', native: 'প্রভাত', lang: 'bn', raga: 'Bhairav', font: 'disp', key: '#ffc247', footage: 's06_diamond'},
  {id: 'dispersal', n: 6, start: 9, title: 'Dispersal', native: 'ವಿಸರ್ಜನೆ', lang: 'kn', raga: 'Todi', font: 'sten', key: '#d8342b', footage: 's07_dispersal_alt_chai'},
  {id: 'zero', n: 7, start: 12, title: 'Zero Shadow', native: 'ଛାୟାହୀନ', lang: 'or', raga: 'Bhimpalasi', font: 'sans', key: '#e9b43b', footage: 's08_zero'},
  {id: 'return', n: 8, start: 15, title: 'Return', native: 'திரும்புதல்', lang: 'ta', raga: 'Marwa', font: 'sans', key: '#f0a060', footage: 's09_return'},
];

const hh = (h: number) => String(((h % 24) + 24) % 24).padStart(2, '0') + ':00';
export const span = (c: Chapter) => `${hh(c.start)} – ${hh(c.start + 3)}`;

// Wide-tracked uppercase, the site's signature (eyebrow, meta, buttons).
export const tracked = (size: number, spacing = 0.3, weight = 500) => ({
  fontFamily: FONT.sans, fontWeight: weight, fontSize: size, letterSpacing: `${spacing}em`,
  textTransform: 'uppercase' as const, lineHeight: 1.15,
});

// The title face per chapter, matching #cTitle.f-* in index.html.
export const titleStyle = (font: ChapterFont, size: number) =>
  font === 'disp'
    ? {fontFamily: FONT.disp, fontWeight: 400, fontSize: size, letterSpacing: '0.16em', textTransform: 'uppercase' as const}
    : font === 'sten'
      ? {fontFamily: FONT.sten, fontWeight: 700, fontSize: size * 1.12, letterSpacing: '0.08em', textTransform: 'uppercase' as const}
      : {fontFamily: FONT.sans, fontWeight: 300, fontSize: size, letterSpacing: '0.3em', textTransform: 'uppercase' as const};
