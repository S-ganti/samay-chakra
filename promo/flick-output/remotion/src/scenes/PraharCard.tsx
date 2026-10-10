import type {FC} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Footage, Grain} from '../lib/Footage';
import {CornerDial, CORNER} from '../lib/CornerDial';
import {useFormat} from '../lib/format';
import {easeInOut, ramp} from '../lib/motion';
import {CHAPTERS, C, FONT, span, titleStyle, tracked, type Chapter} from '../lib/tokens';
import {RiseLetters} from '../lib/Type';

const INK = '15,13,11';

const hex = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

type Look = {startFrom: number; focusY: number; push: number; dim: number; scrim: number};
// Footage offsets / legibility per chapter. startFrom is in frames into the captured clip.
export const LOOK: Record<string, Look> = {
  enter: {startFrom: 15, focusY: 50, push: 0.08, dim: 0.16, scrim: 0.5},
  gathering: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.14, scrim: 0.5},
  eclipse: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.12, scrim: 0.5},
  brahma: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.12, scrim: 0.5},
  diamond: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.24, scrim: 0.55},
  dispersal: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.3, scrim: 0.6},
  zero: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.32, scrim: 0.62},
  return: {startFrom: 0, focusY: 50, push: 0.08, dim: 0.22, scrim: 0.52},
};

// 9:16 title line breaks (balanced, like the site's text-wrap: balance on a phone)
const V_LINES: Record<string, string[]> = {
  enter: ['Enter the', 'Ring'],
  gathering: ['The', 'Gathering'],
  eclipse: ['Eclipse'],
  brahma: ['Brahma', 'Muhurta'],
  diamond: ['Diamond', 'Ring'],
  dispersal: ['Dispersal'],
  zero: ['Zero', 'Shadow'],
  return: ['Return'],
};

// rough advance per character in em (incl. the face's tracking), only used to fit a line to the safe width
const ADV = {disp: 0.92, sans: 0.9, sten: 0.6} as const;

export const PraharCard: FC<{chapter: Chapter; nextColor?: string}> = ({chapter, nextColor}) => {
  const frame = useCurrentFrame();
  const {durationInFrames: D} = useVideoConfig();
  const {v, u, width, height, safe} = useFormat();
  const look = LOOK[chapter.id];

  // ---- layout
  const availW = width - safe.left - safe.right;
  const lines = v ? V_LINES[chapter.id] : [chapter.title];
  const widest = Math.max(...lines.map((l) => l.length));
  const cap = (v ? 112 : 118) * (chapter.font === 'sten' ? 1.25 : 1) * u;
  const fontPx = Math.min(cap, (availW * 0.94) / (widest * ADV[chapter.font]) / (chapter.font === 'sten' ? 1.12 : 1));
  const ts = titleStyle(chapter.font, fontPx);
  const lsPx = parseFloat(String(ts.letterSpacing)) * fontPx; // em -> px
  const eyebrowPx = (v ? 30 : 23) * u;
  const nativePx = (v ? 66 : 54) * u;
  const metaPx = Math.min((v ? 30 : 24) * u, (availW * 0.96) / ((span(chapter).length + chapter.raga.length + 9) * 0.86));

  // ---- timing (frames)
  const t0 = v ? 6 : 9; // title starts
  const st = v ? 1.0 : 1.4; // letter stagger
  const nativeAt = t0 + 8; // +0.25 s
  const metaAt = t0 + 14; // +0.45 s
  const dialAt = v ? 6 : 8; // dial fill, 0.6 s
  const fadeEnd = D - 12;
  const textOut = 1 - ramp(frame, fadeEnd - 11, fadeEnd, easeInOut);

  const eyeP = ramp(frame, t0 - 4, t0 + 10);
  const lineP = ramp(frame, t0 + 6, t0 + 24);
  const nativeP = ramp(frame, nativeAt, nativeAt + 14);
  const metaP = ramp(frame, metaAt, metaAt + 14);

  // ---- corner dial: fills from n-1 to n
  const fill = ramp(frame, dialAt, dialAt + 18, easeInOut);
  const arcs = chapter.n - 1 + fill;
  const pulse = ramp(frame, dialAt + 16, dialAt + 34);

  // ---- outro: iris ring sweeps out from the dial in the NEXT chapter's colour while the frame darkens
  const ringColor = nextColor ?? CHAPTERS[chapter.n]?.key ?? C.bone;
  const dc = CORNER(v, u, width, height);
  const cx = dc.x + dc.size / 2;
  const cy = dc.y + dc.size / 2;
  const maxR = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + 40 * u;
  const irisP = ramp(frame, D - 11, D - 2, easeInOut);
  const r = irisP * maxR;
  const band = 150 * u;
  const darken = ramp(frame, D - 12, D - 1, easeInOut);

  // text block centre: the middle of the safe area
  const boxStyle = {
    position: 'absolute' as const,
    left: safe.left, right: safe.right, top: safe.top, bottom: safe.bottom,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const scrimW = Math.min(availW * 1.15, 1100 * u);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Footage clip={chapter.footage} startFrom={look.startFrom} push={look.push} dim={look.dim} focusY={look.focusY} />
      <Grain opacity={0.05} />

      {/* local scrim behind the card, like the site's .card-in radial */}
      <div style={{...boxStyle, opacity: textOut}}>
        <div style={{
          width: scrimW, height: scrimW * 0.78, borderRadius: '50%', flex: 'none',
          background: `radial-gradient(ellipse at center, rgba(${INK},${look.scrim}) 0%, rgba(${INK},${look.scrim * 0.62}) 42%, rgba(${INK},0) 72%)`,
        }} />
      </div>

      {/* the chapter card */}
      <div style={{...boxStyle, opacity: textOut}}>
        <div style={{textAlign: 'center', textShadow: `0 2px ${24 * u}px rgba(${INK},.75), 0 0 ${3 * u}px rgba(${INK},.35)`, width: '100%'}}>
          <div style={{...tracked(eyebrowPx, 0.36), color: C.bone2, opacity: eyeP, transform: `translateY(${(1 - eyeP) * 10 * u}px)`, paddingLeft: '0.36em'}}>
            The Ring / Samay Chakra
          </div>

          <div style={{position: 'relative', display: 'inline-block', margin: `${18 * u * 1.4}px 0 ${6 * u}px`, color: C.bone, lineHeight: 1.04, paddingLeft: lsPx}}>
            {lines.map((l, i) => (
              <div key={l} style={{...ts, lineHeight: 1.04}}>
                <RiseLetters text={l} at={t0 + i * 5} stagger={st} dur={16} />
              </div>
            ))}
            {/* the site's #cTitle::after hairline + ::before dot, in the chapter colour */}
            <div style={{position: 'absolute', left: `${-4 * lineP}%`, right: `${-4 * lineP}%`, top: '52%', height: 2 * u,
              background: chapter.key, opacity: 0.95, transform: `scaleX(${lineP})`, transformOrigin: '50% 50%', boxShadow: `0 0 ${10 * u}px ${hex(chapter.key, 0.7)}`}} />
            <div style={{position: 'absolute', left: '50%', top: `calc(52% - ${6 * u}px)`, width: 13 * u, height: 13 * u, marginLeft: -6.5 * u,
              borderRadius: '50%', background: chapter.key, boxShadow: `0 0 ${16 * u}px ${chapter.key}`, opacity: lineP, transform: `scale(${0.4 + 0.6 * lineP})`}} />
          </div>

          <div lang={chapter.lang} style={{fontFamily: FONT.native, fontWeight: 500, fontSize: nativePx, lineHeight: 1.6, color: chapter.key,
            marginTop: chapter.lang === 'ur' ? (v ? 40 : 18) * u : 0, opacity: nativeP, transform: `translateY(${(1 - nativeP) * 14 * u}px)`,
            textShadow: `0 1px ${3 * u}px rgba(${INK},.9), 0 2px ${22 * u}px rgba(${INK},.8)`}}>
            {chapter.native}
          </div>

          <div style={{...tracked(metaPx, 0.24, 400), lineHeight: 1.5, marginTop: 6 * u, color: C.bone, opacity: metaP * 0.92, paddingLeft: '0.24em'}}>
            {span(chapter)} · Raga {chapter.raga}
          </div>
        </div>
      </div>

      {/* outro: darken + iris ring in the next chapter's colour, centred on the corner dial */}
      {irisP > 0 && (
        <>
          <AbsoluteFill style={{backgroundColor: `rgb(${INK})`, opacity: darken * 0.3}} />
          <AbsoluteFill style={{
            background: `radial-gradient(circle at ${cx}px ${cy}px, rgba(${INK},.8) 0px, rgba(${INK},.8) ${Math.max(0, r - band)}px, ${hex(ringColor, 0.3)} ${Math.max(0, r - 2)}px, rgba(${INK},0) ${r}px)`,
          }} />
          <svg width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringColor} strokeWidth={4 * u}
              style={{filter: `drop-shadow(0 0 ${12 * u}px ${ringColor})`}} />
          </svg>
        </>
      )}

      {/* the docked dial rides above everything so the hard cuts never make it jump */}
      <CornerDial arcs={arcs} pulse={pulse < 1 ? pulse : 0} />
    </AbsoluteFill>
  );
};

const byId = (id: string) => CHAPTERS.find((c) => c.id === id)!;
const mk = (id: string, nextColor?: string): FC => () => <PraharCard chapter={byId(id)} nextColor={nextColor} />;

export const PraharEnter = mk('enter');
export const PraharGathering = mk('gathering');
export const PraharEclipse = mk('eclipse');
export const PraharBrahma = mk('brahma');
export const PraharDiamond = mk('diamond');
export const PraharDispersal = mk('dispersal');
export const PraharZero = mk('zero');
// Return hands over to pick-a-style, so its iris ring is bone.
export const PraharReturn = mk('return', C.bone);
