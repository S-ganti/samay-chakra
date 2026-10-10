import type {CSSProperties, FC} from 'react';
import {C, FONT} from '../lib/tokens';
import {RingDial} from '../lib/RingDial';
import {useFormat} from '../lib/format';

/**
 * Shared by group A: the hero dial that scene 2 ends on and scene 3 opens on (hard-cut continuity),
 * plus the Doto clock readout and the safe-area centre used by every 9:16 text block.
 */
export const useHero = () => {
  const f = useFormat();
  const {v, width, height, safe} = f;
  // 9:16: centre on the middle of the area the platform UI leaves free (right rail covers 14%)
  const cx = v ? (safe.left + (width - safe.right)) / 2 : width / 2;
  const size = 520;
  const cy = v ? height * 0.5 : height * 0.55;
  return {...f, cx, cy, size};
};

/** Dial + own hand (hand length draws with `handDraw`). `deg` = hand angle clockwise from 12 o'clock. */
export const HeroDial: FC<{
  draw?: number; spokes?: number; arcs?: number; deg?: number | null; handDraw?: number;
  scale?: number; opacity?: number; backing?: number; arcWidth?: number;
}> = ({draw = 1, spokes = 1, arcs = 0, deg = null, handDraw = 1, scale = 1, opacity = 1, backing = 0.4, arcWidth = 4.2}) => {
  const {cx, cy, size} = useHero();
  return (
    <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, opacity,
      transform: `scale(${scale})`, transformOrigin: '50% 50%'}}>
      {backing > 0 && (
        <div style={{position: 'absolute', inset: -size * 0.12, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(15,13,11,${backing}) 0%, rgba(15,13,11,${backing * 0.8}) 52%, rgba(15,13,11,0) 72%)`}} />
      )}
      <div style={{position: 'absolute', inset: 0}}>
        <RingDial size={size} draw={draw} spokes={spokes} arcs={arcs} arcWidth={arcWidth} glow={0.35} />
      </div>
      {deg !== null && (
        <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <line x1={50} y1={50} x2={50} y2={50 - 36 * handDraw} stroke={C.bone} strokeWidth={1.8} strokeLinecap="round"
            transform={`rotate(${deg} 50 50)`} />
          <circle cx={50} cy={50} r={2.4} fill={C.bone} opacity={handDraw} />
        </svg>
      )}
    </div>
  );
};

/** Doto dot-matrix clock. `minutes` is minutes since 00:00 (wraps). */
export const fmtClock = (minutes: number) => {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

export const ClockDigits: FC<{minutes: number; size: number; opacity?: number; style?: CSSProperties}> = ({minutes, size, opacity = 1, style}) => (
  <div style={{fontFamily: FONT.dot, fontWeight: 700, fontSize: size, letterSpacing: '0.06em', color: C.bone, lineHeight: 1,
    textShadow: '0 0 28px rgba(255,122,47,.35)', opacity, fontVariantNumeric: 'tabular-nums', ...style}}>
    {fmtClock(minutes)}
  </div>
);

/** Hand angle (deg clockwise from 12) for a minute-of-day. 18:00 = 270°. */
export const handDegAt = (minutes: number) => ((minutes % 1440) / 1440) * 360;
/** Minutes shown at the end of the scene-2 sweep: 17:59. */
export const SWEEP_MINUTES = (p: number) => 1080 + Math.floor(1439 * p);

export const sfxVol = (db: number) => Math.pow(10, db / 20);

// Footage offsets (frames into each clip) shared between neighbouring scenes so motion carries over a cut.
// Scene 3's last frames fade in the first shot of scene 4; scene 4 picks up from the same moment.
export const GATHERING_START = 0; // s03_gathering, first shot of scene 4
export const SHOT_FRAMES_CARRY = 9; // frames of s03 shown at the tail of scene 3
