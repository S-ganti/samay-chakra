import type {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {easeInOut, ramp} from '../lib/motion';
import {useFormat} from '../lib/format';
import {Footage} from '../lib/Footage';
import {Hairline, WipeLine} from '../lib/Type';

// Frame offset into s12_carving.mp4 (chosen to avoid camera cuts).
const START_FROM = 0;

// The carving outline, in the 1920x1080 frame (a cusped temple-niche arch that the macro push settles on).
// Drawn with a pathLength-normalised dash so it traces over 2 s.
const OUTLINE = 'M 700 930 L 700 520 C 700 400 790 330 860 290 C 900 268 930 230 960 170 C 990 230 1020 268 1060 290 C 1130 330 1220 400 1220 520 L 1220 930';

const TRACE_A = 14;
const TRACE_B = 74; // 2 s
const FADE_A = 84;
const FADE_B = 108;

export const CarvedStone: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const {u, safe} = useFormat();

  // slow macro push with a gentle lateral drift; the outline rides the same transform so it stays on the stone
  const scale = interpolate(frame, [0, dur], [1.1, 1.24]);
  const dx = interpolate(frame, [0, dur], [34, -34]);
  const trace = ramp(frame, TRACE_A, TRACE_B, easeInOut);
  const lineOp = 1 - ramp(frame, FADE_A, FADE_B, easeInOut);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <AbsoluteFill style={{transform: `translateX(${dx}px) scale(${scale})`, transformOrigin: '50% 55%'}}>
        <Footage clip="s12_carving" startFrom={START_FROM} push={0} dim={0.12} />
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity: lineOp}}>
          <path d={OUTLINE} pathLength={1} fill="none" stroke={C.bone} strokeWidth={2.2 / scale} strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={1} strokeDashoffset={1 - trace} style={{filter: 'drop-shadow(0 0 5px rgba(237,227,209,.55))'}} />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.72) 0%, rgba(15,13,11,.36) 26%, rgba(15,13,11,0) 52%)'}} />
      <div style={{position: 'absolute', left: safe.left, right: safe.right, bottom: safe.bottom + 14 * u, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 * u}}>
        <Hairline at={6} width={340 * u} />
        <WipeLine at={8} dur={16}>
          <div style={{fontFamily: FONT.disp, fontSize: 56 * u, letterSpacing: '0.1em', color: C.bone, textTransform: 'uppercase', textAlign: 'center',
            paddingLeft: '0.1em', textShadow: '0 2px 24px rgba(15,13,11,.7)'}}>
            Carved sandstone, granite and marble.
          </div>
        </WipeLine>
      </div>
    </AbsoluteFill>
  );
};
