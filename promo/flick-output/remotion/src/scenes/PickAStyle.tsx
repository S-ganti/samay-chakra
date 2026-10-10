import type {FC} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Footage, Grain} from '../lib/Footage';
import {useFormat} from '../lib/format';
import {easeInOut, ramp} from '../lib/motion';
import {C, FONT, tracked} from '../lib/tokens';
import {Hairline, RiseLetters} from '../lib/Type';

const INK = '15,13,11';
const STYLES = [
  {clip: 's11_style_real', name: 'Realistic'},
  {clip: 's11_style_fusion', name: 'Fusion Posters'},
  {clip: 's11_style_sumi', name: 'Sumi Ink'},
  {clip: 's11_style_neon', name: 'Chungking Neon'},
  {clip: 's11_style_paint', name: 'Painted Light'},
];
// Same moment in every style render: identical startFrom keeps the five clips time-aligned.
const START_FROM = 0;
const CLICK_VOL = Math.pow(10, -18 / 20);

/** Vertical blade edge: reveal polygon whose leading edge leans, sweeping left → right. */
const bladeX = (p: number, w: number, lean: number) => -lean + p * (w + lean * 2);

export const PickAStyle: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: D} = useVideoConfig();
  const {v, u, width, height, safe} = useFormat();

  // ---- timing
  const intro = 30; // eyebrow line over the unfocused first shot (1.0 s)
  const W = v ? 15 : 19; // blade wipe length
  const seg = Math.round((D - intro - W - 26) / 4); // 39 (9:16) / 49 (16:9): one style per ~1.3 / 1.6 s
  const bEnd = (k: number) => intro + W + seg * k; // frame style k is fully revealed (first blade opens at `intro`)
  const bStart = (k: number) => bEnd(k) - W;
  const wipeP = (k: number) => ramp(frame, bStart(k), bEnd(k), easeInOut);
  const active = Math.max(-1, ...STYLES.map((_, k) => (frame >= bStart(k) ? k : -1))); // newest style started
  const lean = height * 0.05;

  // clip-path polygon for style k's reveal (area left of the blade)
  const poly = (p: number) => {
    const x = bladeX(p, width, lean);
    return `polygon(0 0, ${x + lean}px 0, ${x - lean}px ${height}px, 0 ${height}px)`;
  };

  // ---- the intro line
  const introOut = 1 - ramp(frame, bStart(1) - 12, bStart(1) - 1, easeInOut); // stays up over the first sharp style, like a header
  const introFs = (v ? 54 : 50) * u;
  const bottomAnchor = height - safe.bottom;

  // ---- label / chips layout (bottom of the safe area)
  const availW = width - safe.left - safe.right;
  const nameFs = Math.min((v ? 62 : 70) * u, (availW * 0.92) / (14 * 0.95));
  const chip = (v ? 48 : 40) * u;

  const bladeLine = (k: number) => {
    const p = wipeP(k);
    if (p <= 0 || p >= 1) return null;
    const x = bladeX(p, width, lean);
    const a = Math.min(1, p * 8, (1 - p) * 8);
    return (
      <svg key={k} width={width} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: a}}>
        <line x1={x + lean} y1={0} x2={x - lean} y2={height} stroke={C.bone} strokeWidth={2.5 * u} style={{filter: `drop-shadow(0 0 ${10 * u}px rgba(237,227,209,.8))`}} />
      </svg>
    );
  };

  const layer = (k: number) => {
    // only mount a clip while it can be seen: from its wipe start until the next one fully covers it
    if (frame < bStart(k)) return null;
    if (k < 4 && wipeP(k + 1) >= 1) return null;
    return (
      <AbsoluteFill key={k} style={{clipPath: poly(wipeP(k))}}>
        <Footage clip={STYLES[k].clip} startFrom={START_FROM} push={0.06} dim={0.12} />
      </AbsoluteFill>
    );
  };

  // the opening shot: style 0, unfocused and dimmed until the first blade opens it up
  const introVeil = 1 - wipeP(0);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {introVeil > 0 && (
        <>
          <AbsoluteFill style={{filter: `blur(${14 * u}px)`}}>
            <Footage clip={STYLES[0].clip} startFrom={START_FROM} push={0.06} dim={0.12} />
          </AbsoluteFill>
          <AbsoluteFill style={{backgroundColor: `rgb(${INK})`, opacity: 0.42}} />
        </>
      )}
      {STYLES.map((_, k) => layer(k))}
      {STYLES.map((_, k) => bladeLine(k))}
      <Grain opacity={0.05} />

      {/* bottom scrim for the label */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: height - bottomAnchor + 360 * u,
        background: `linear-gradient(to top, rgba(${INK},.72) 0%, rgba(${INK},.5) 55%, rgba(${INK},0) 100%)`,
        opacity: ramp(frame, bStart(0), bEnd(0))}} />

      {/* intro line: PICK HOW YOU SEE IT (with a soft local scrim, like the chapter card) */}
      <div style={{position: 'absolute', left: safe.left, right: safe.right, top: safe.top, bottom: safe.bottom, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: introOut}}>
        <div style={{width: Math.min(availW * 1.1, 1000 * u), height: 330 * u, borderRadius: '50%', flex: 'none',
          background: `radial-gradient(ellipse at center, rgba(${INK},.5) 0%, rgba(${INK},.3) 45%, rgba(${INK},0) 72%)`}} />
      </div>
      <div style={{position: 'absolute', left: safe.left, right: safe.right, top: safe.top, bottom: safe.bottom, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', opacity: introOut, textAlign: 'center'}}>
        <div style={{fontFamily: FONT.sans, fontWeight: 400, fontSize: introFs, letterSpacing: '0.36em', paddingLeft: '0.36em', textTransform: 'uppercase',
          color: C.bone, lineHeight: 1.3, textShadow: `0 2px ${24 * u}px rgba(${INK},.8)`}}>
          <RiseLetters text="Pick how" at={0} stagger={1.1} dur={14} /><br />
          <RiseLetters text="you see it" at={5} stagger={1.1} dur={14} />
        </div>
        <div style={{marginTop: 22 * u}}>
          <Hairline at={10} width={(v ? 300 : 360) * u} color={C.bone2} thickness={1.5 * u} />
        </div>
      </div>

      {/* style name + 5-dot selector, bottom of the safe area */}
      <div style={{position: 'absolute', left: safe.left, right: safe.right, bottom: safe.bottom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 * u}}>
        <div style={{position: 'relative', height: nameFs * 1.2, width: '100%'}}>
          {STYLES.map((s, k) => {
            const inAt = bEnd(k) - W * 0.55;
            const outAt = k < 4 ? bStart(k + 1) : D + 99;
            const out = ramp(frame, outAt, outAt + 9);
            if (frame < inAt - 1 || out >= 1) return null;
            return (
              <div key={k} style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: 1 - out,
                transform: `translateY(${-out * 8 * u}px)`}}>
                <div style={{fontFamily: FONT.sans, fontWeight: 400, fontSize: nameFs, letterSpacing: '0.28em', paddingLeft: '0.28em', textTransform: 'uppercase', color: C.bone,
                  whiteSpace: 'nowrap', lineHeight: 1.1, textShadow: `0 2px ${22 * u}px rgba(${INK},.85), 0 0 ${3 * u}px rgba(${INK},.4)`}}>
                  <RiseLetters text={s.name} at={inAt} stagger={0.9} dur={13} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display: 'flex', gap: chip * 0.32, opacity: ramp(frame, bStart(0), bEnd(0))}}>
          {STYLES.map((_, k) => {
            const lit = wipeP(k) * (k < 4 ? 1 - wipeP(k + 1) : 1);
            const bg = `rgba(237,227,209,${lit})`;
            return (
              <div key={k} style={{width: chip, height: chip, borderRadius: '50%', border: `${1.5 * u}px solid ${lit > 0.5 ? C.bone : C.hair2}`, background: bg,
                display: 'grid', placeItems: 'center', fontFamily: FONT.mono, fontWeight: 500, fontSize: chip * 0.42, color: lit > 0.5 ? '#0d0b09' : C.bone2,
                boxShadow: lit > 0.3 ? `0 0 ${12 * u}px rgba(237,227,209,${0.5 * lit})` : undefined, textShadow: lit > 0.5 ? 'none' : `0 1px ${6 * u}px rgba(${INK},.8)`}}>
                {k + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Click on each blade wipe, -18 dB */}
      {STYLES.map((_, k) => (
        <Sequence key={k} from={Math.max(0, bStart(k) + 2)} durationInFrames={30} layout="none">
          <Audio src={staticFile('sounds/Click.mp3')} volume={CLICK_VOL} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
