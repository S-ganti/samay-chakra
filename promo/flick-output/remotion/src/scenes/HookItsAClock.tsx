import type {FC} from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from '../lib/tokens';
import {Grain} from '../lib/Footage';
import {WipeLine} from '../lib/Type';
import {ramp, easeInOut} from '../lib/motion';
import {ClockDigits, HeroDial, SWEEP_MINUTES, handDegAt, sfxVol, useHero} from './a_shared';

// The 24 h time-lapse is played so the WHOLE day cycle fits the scene: clip frames per scene frame.
const TL_START = 0; // frames into the clip
const TL_CLIP_FRAMES = 180; // frames of one full 24 h cycle in the clip (from the manifest); 0 = play at 1x

export const HookItsAClock: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const {v, u, cx, cy, size, width, height, safe} = useHero();
  const end = durationInFrames;
  const rate = TL_CLIP_FRAMES ? TL_CLIP_FRAMES / end : 1; // squeeze one full day into the scene

  const draw = ramp(frame, 0, 9);
  const handDraw = ramp(frame, 3, 10);
  const sweepEnd = end - 6; // last 6 frames hold on 17:59
  const p = interpolate(frame, [2, sweepEnd], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); // linear: it IS the time-lapse
  const minutes = SWEEP_MINUTES(p);
  const deg = handDegAt(minutes);
  // footage darkens toward the cut so scene 3 (ink) opens on the same dial without a jump
  const dim = 0.14 + 0.62 * ramp(frame, end - 14, end, easeInOut);
  const textOp = (1 - ramp(frame, end - 10, end - 3, easeInOut));

  const headSize = (v ? 124 : 104) * u;
  const dialTop = cy - size / 2;
  const dialBottom = cy + size / 2;

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <OffthreadVideo
          src={staticFile('footage/s01_timelapse_day.mp4')}
          startFrom={TL_START}
          playbackRate={rate}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1 + 0.04 * (frame / end)})`}}
        />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 48%, rgba(15,13,11,0) 38%, rgba(15,13,11,.55) 100%)'}} />
        <AbsoluteFill style={{backgroundColor: C.ink, opacity: dim}} />
      </AbsoluteFill>
      <Grain opacity={0.05} />

      {/* payoff line, legible from frame ~6 */}
      <div style={{position: 'absolute', left: safe.left, right: safe.right, bottom: height - dialTop + (v ? 70 : 40) * u,
        display: 'flex', justifyContent: 'center', textAlign: 'center', opacity: textOp}}>
        <WipeLine at={0} dur={9}>
          <div style={{fontFamily: FONT.disp, fontSize: headSize, letterSpacing: '0.12em', lineHeight: 1.12, color: C.bone,
            textTransform: 'uppercase', textShadow: '0 2px 30px rgba(15,13,11,.75)', whiteSpace: v ? 'normal' : 'nowrap'}}>
            {v ? <>IT&rsquo;S A<br />CLOCK.</> : <>IT&rsquo;S A CLOCK.</>}
          </div>
        </WipeLine>
      </div>

      <HeroDial draw={draw} spokes={ramp(frame, 2, 10)} deg={deg} handDraw={handDraw} backing={0.42} />

      {/* the Doto clock runs through the day: 18:00 -> 17:59 */}
      <div style={{position: 'absolute', left: safe.left, right: safe.right, top: dialBottom + (v ? 64 : 34) * u,
        display: 'flex', justifyContent: 'center', opacity: ramp(frame, 1, 6)}}>
        <ClockDigits minutes={minutes} size={(v ? 150 : 120) * u} />
      </div>

      <Sequence from={8}>
        <Audio src={staticFile('sounds/Impact.mp3')} volume={sfxVol(-14)} />
      </Sequence>
    </AbsoluteFill>
  );
};
