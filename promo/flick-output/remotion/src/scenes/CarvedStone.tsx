import type {FC} from 'react';
import {AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {easeInOut, ramp} from '../lib/motion';
import {useFormat} from '../lib/format';
import {Hairline, WipeLine} from '../lib/Type';

// s12_carving is a 4.1 s square capture (1280²) of the camera pushing in on the carved lotus hub of the portal wheel.
// Played at 0.8x it fills the 5 s scene exactly and stays a slow macro push.
const START_FROM = 0;
const RATE = 0.8;

// The hairline traces the hub's outer rim. The capture's camera push makes the rim grow, so its centre and
// vertical radius are keyed to the clip frame (measured on the 1920x1080 cover crop of the capture).
const rim = (c: number) => ({cx: 836 + 0.27 * c, cy: 526 - 0.06 * c, ry: 270 + 0.063 * c + 0.00955 * c * c});
const RX = 0.955; // the rim reads as a slightly squashed ellipse in perspective

const TRACE_A = 14;
const TRACE_B = 74; // 2 s
const FADE_A = 86;
const FADE_B = 110;

export const CarvedStone: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const {u, safe} = useFormat();

  const scale = interpolate(frame, [0, dur], [1, 1.05], {easing: easeInOut});
  const trace = ramp(frame, TRACE_A, TRACE_B, easeInOut);
  const lineOp = 1 - ramp(frame, FADE_A, FADE_B, easeInOut);

  // the outline follows the rim as the camera pushes: it is drawn from the current frame's rim geometry
  const c = frame * RATE + START_FROM;
  const {cx, cy, ry} = rim(c);
  const rx = ry * RX;
  const d = `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
  // leading point of the trace
  const ang = trace * 2 * Math.PI;
  const tip = {x: cx + Math.sin(ang) * rx, y: cy - Math.cos(ang) * ry};

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <AbsoluteFill style={{transform: `scale(${scale})`, transformOrigin: '45% 50%', overflow: 'hidden'}}>
        <OffthreadVideo src={staticFile('footage/s12_carving.mp4')} startFrom={START_FROM} playbackRate={RATE} muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(15,13,11,0) 40%, rgba(15,13,11,.5) 100%)'}} />
        <AbsoluteFill style={{backgroundColor: C.ink, opacity: 0.08}} />
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity: lineOp, overflow: 'visible'}}>
          <path d={d} pathLength={1} fill="none" stroke={C.bone} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${trace} 2`} style={{filter: 'drop-shadow(0 0 5px rgba(237,227,209,.6)) drop-shadow(0 0 1px rgba(15,13,11,.8))'}} />
          {trace > 0 && trace < 1 && <circle cx={tip.x} cy={tip.y} r={5} fill={C.ember} style={{filter: 'drop-shadow(0 0 8px #ff7a2f)'}} />}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.8) 0%, rgba(15,13,11,.45) 22%, rgba(15,13,11,0) 46%)'}} />
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
