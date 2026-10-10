import type {FC} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {Footage} from '../lib/Footage';
import {RingDial} from '../lib/RingDial';
import {CORNER} from '../lib/CornerDial';
import {WipeLine} from '../lib/Type';
import {easeInOut, ramp} from '../lib/motion';
import {sfxVol, useHero} from './a_shared';

const START_FROM = 0; // s02_enter, blurred; offset set from the manifest
const DOCK_AT = 18; // dial reaches the corner here; the click lands on this frame

export const IBuiltAllEight: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: end} = useVideoConfig();
  const {v, u, cx, width, height, safe} = useHero();
  const corner = CORNER(v, u, width, height);

  const m = ramp(frame, 1, DOCK_AT, easeInOut); // 0 = hero position, 1 = docked
  // the ring starts above the line (so they never overlap) and shrinks into the corner
  const sSize = v ? 360 : 260 * u;
  const sx = cx - sSize / 2, sy = (v ? height * 0.29 : height * 0.27) - sSize / 2;
  const size = interpolate(m, [0, 1], [sSize, corner.size]);
  const x = interpolate(m, [0, 1], [sx, corner.x]);
  const y = interpolate(m, [0, 1], [sy, corner.y]);

  const blur = 18 * (1 - ramp(frame, DOCK_AT - 4, end - 1, easeInOut));
  const dim = 0.5 - 0.34 * ramp(frame, DOCK_AT - 4, end - 1, easeInOut);
  const textOp = 1 - ramp(frame, end - 6, end - 1, easeInOut);
  const headSize = (v ? 132 : 116) * u;

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Footage clip="s02_enter" startFrom={START_FROM} push={0.05} dim={dim} blur={blur} />

      <div style={{position: 'absolute', left: safe.left, right: safe.right, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', opacity: textOp, paddingTop: v ? 60 * u : 0}}>
        <WipeLine at={-3} dur={7}>
          <div style={{fontFamily: FONT.disp, fontSize: headSize, letterSpacing: '0.12em', lineHeight: 1.14, color: C.bone, textTransform: 'uppercase',
            textShadow: '0 2px 30px rgba(15,13,11,.8)', whiteSpace: 'nowrap'}}>
            {v ? <>I BUILT<br />ALL EIGHT.</> : <>I BUILT ALL EIGHT.</>}
          </div>
        </WipeLine>
      </div>

      {/* the ring shrinks into the corner progress dial (0/8) and stays for the montage */}
      <div style={{position: 'absolute', left: x, top: y, width: size, height: size}}>
        <RingDial size={size} arcs={0} arcWidth={interpolate(m, [0, 1], [4.2, 7])} spokes={interpolate(m, [0, 1], [1, 0.5])} glow={interpolate(m, [0, 1], [0.35, 0.4])} />
      </div>

      <Sequence from={DOCK_AT}><Audio src={staticFile('sounds/Click.mp3')} volume={sfxVol(-16)} /></Sequence>
    </AbsoluteFill>
  );
};
