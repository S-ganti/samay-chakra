import type {CSSProperties, FC, ReactNode} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {easeOut, ramp} from '../lib/motion';
import {useFormat} from '../lib/format';
import {CORNER, CornerDial} from '../lib/CornerDial';
import {Footage} from '../lib/Footage';
import {Hairline, WipeLine} from '../lib/Type';

// Footage offsets (frames into each clip), picked to avoid camera cuts.
const MOON_START = 0;
const RAIN_START = 0;
const CROWD_START = 0;

// The moon clip's visible phase. 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
// `null` shows no disc, just the generic live label.
const MOON_PHASE: number | null = null;
const MOON_LABEL = 'MOON PHASE · LIVE';

const BPM = 128;
const BEAT = (30 * 60) / BPM; // 14.06 frames

/** Lit portion of the moon disc for a phase 0..1 (northern-hemisphere style: waxing lights the right). */
const MoonDisc: FC<{size: number; phase: number}> = ({size, phase}) => {
  const a = Math.cos(phase * 2 * Math.PI); // 1 new … -1 full
  const rx = Math.abs(a) * 40;
  const waxing = phase < 0.5;
  // right/left half arc, then the terminator ellipse back
  const outer = waxing ? 'M50 10 A40 40 0 0 1 50 90' : 'M50 10 A40 40 0 0 0 50 90';
  const sweep = (waxing ? a > 0 : a < 0) ? 0 : 1;
  const inner = waxing ? `A${rx} 40 0 0 ${sweep} 50 10` : `A${rx} 40 0 0 ${sweep ? 0 : 1} 50 10`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={40} fill="none" stroke={C.bone3} strokeWidth={2.5} />
      <path d={`${outer} ${inner} Z`} fill={C.bone} />
    </svg>
  );
};

/** Small Doto dot-matrix readout in the site's HUD manner. */
const Readout: FC<{at: number; label: string; size: number; phase?: number | null}> = ({at, label, size, phase}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 10);
  const blink = Math.floor(frame / 12) % 2 === 0;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: size * 0.55, opacity: p, transform: `translateY(${(1 - p) * 8}px)`,
      padding: `${size * 0.35}px ${size * 0.7}px`, border: `1px solid ${C.hair2}`, borderRadius: size, background: 'rgba(15,13,11,.5)'}}>
      {phase != null ? <MoonDisc size={size * 1.4} phase={phase} /> : (
        <div style={{width: size * 0.42, height: size * 0.42, borderRadius: '50%', background: C.ember, opacity: blink ? 1 : 0.35}} />
      )}
      <div style={{fontFamily: FONT.dot, fontWeight: 700, fontSize: size, letterSpacing: '0.1em', color: C.bone, whiteSpace: 'nowrap'}}>{label}</div>
    </div>
  );
};

/** One shot: footage, a low ink wash, the phrase wiping in behind a hairline, and an optional readout above it. */
const Shot: FC<{clip: string; startFrom: number; phrase: string; readout?: ReactNode; focusY?: number; dim?: number}> = ({clip, startFrom, phrase, readout, focusY, dim = 0.16}) => {
  const {v, u, safe} = useFormat();
  const size = (v ? 64 : 62) * u;
  const box: CSSProperties = {
    position: 'absolute', left: safe.left, right: safe.right, bottom: v ? safe.bottom + 36 * u : safe.bottom + 14 * u,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 22 * u,
  };
  return (
    <AbsoluteFill>
      <Footage clip={clip} startFrom={startFrom} push={0.06} dim={dim} focusY={focusY} />
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.7) 0%, rgba(15,13,11,.38) 30%, rgba(15,13,11,0) 58%)'}} />
      <div style={box}>
        {readout}
        <Hairline at={4} width={(v ? 260 : 340) * u} />
        <WipeLine at={5} dur={11}>
          <div style={{fontFamily: FONT.disp, fontSize: size, letterSpacing: '0.1em', color: C.bone, lineHeight: 1.2, textTransform: 'uppercase',
            textShadow: '0 2px 24px rgba(15,13,11,.7)', maxWidth: v ? '100%' : 1300 * u, paddingLeft: '0.1em', textWrap: 'balance' as CSSProperties['textWrap']}}>
            {phrase}
          </div>
        </WipeLine>
      </div>
    </AbsoluteFill>
  );
};

export const RealSky: FC = () => {
  const frame = useCurrentFrame();
  const {v, u, width, height} = useFormat();
  // cuts land on beats: 3+3 beats then the crowd (v), 5+5 beats then the crowd (h)
  const c1 = Math.round((v ? 3 : 5) * BEAT);
  const c2 = Math.round((v ? 6 : 10) * BEAT);
  const dur = v ? 180 : 240;

  // beat-synced pulse on the corner dial, crowd shot only: kick at each beat, eased back out
  const f = frame - c2;
  const phase = f >= 0 ? (f % BEAT) / BEAT : 1;
  const kick = 1 - easeOut(Math.min(1, phase * 1.4));
  const pulse = f >= 0 ? easeOut(phase) : 0;
  const cd = CORNER(v, u, width, height);
  const dialStyle: CSSProperties = {transform: `scale(${1 + 0.1 * kick})`, transformOrigin: `${cd.x + cd.size / 2}px ${cd.y + cd.size / 2}px`};

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Sequence from={0} durationInFrames={c1}>
        <Shot clip="s14_moon" startFrom={MOON_START} phrase="Tonight’s real moon." focusY={40}
          readout={<Readout at={8} label={MOON_LABEL} size={(v ? 30 : 26) * u} phase={MOON_PHASE} />} />
      </Sequence>
      <Sequence from={c1} durationInFrames={c2 - c1}>
        <Shot clip="s13_rain" startFrom={RAIN_START} phrase="Bengaluru’s real weather."
          readout={<Readout at={8} label="12.97°N · 77.59°E" size={(v ? 30 : 26) * u} />} />
      </Sequence>
      <Sequence from={c2} durationInFrames={dur - c2}>
        <Shot clip="s10_crowd_dance" startFrom={CROWD_START} phrase="A crowd that dances on the beat." />
      </Sequence>
      {/* the corner dial, full, docked in its fixed position */}
      <AbsoluteFill style={dialStyle}>
        <CornerDial arcs={8} pulse={pulse} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
