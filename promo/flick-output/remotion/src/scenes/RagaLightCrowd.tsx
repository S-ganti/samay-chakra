import type {FC} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, tracked} from '../lib/tokens';
import {Footage} from '../lib/Footage';
import {WipeLine} from '../lib/Type';
import {ramp} from '../lib/motion';
import {GATHERING_START, useHero} from './a_shared';

type Shot = {clip: string; startFrom: number; focusY?: number; lead?: string; word: string; key: string; tag: string; wave?: boolean};

// Offsets (frames into each clip) chosen from the capture manifest.
const SHOTS: Shot[] = [
  {clip: 's03_gathering', startFrom: GATHERING_START, lead: 'EACH WITH', word: 'RAGA.', key: '#e0332a', tag: '01 / 03', wave: true},
  {clip: 's05_brahma', startFrom: 0, word: 'LIGHT.', key: '#7fa2e6', tag: '02 / 03'},
  {clip: 's10_crowd_dance', startFrom: 0, word: 'CROWD.', key: '#ff7a2f', tag: '03 / 03'},
];

/** A thin waveform hairline that breathes, under "RAGA". */
const Wave: FC<{width: number; frame: number; color: string; amp: number}> = ({width, frame, color, amp}) => {
  const pts: string[] = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const env = Math.sin(Math.PI * t) ** 1.5;
    const y = amp * env * (0.6 * Math.sin(t * 18 - frame * 0.42) + 0.4 * Math.sin(t * 41 + frame * 0.29));
    pts.push(`${(t * width).toFixed(1)},${(amp + y).toFixed(2)}`);
  }
  return (
    <svg width={width} height={amp * 2 + 2} style={{overflow: 'visible', display: 'block'}}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
};

const ShotView: FC<{shot: Shot; len: number}> = ({shot, len}) => {
  const frame = useCurrentFrame();
  const {v, u, safe, width, height} = useHero();
  const size = (v ? 140 : 132) * u;
  const edge = ramp(frame, 0, 8);
  const blockW = v ? width - safe.left - safe.right : 900 * u;
  return (
    <AbsoluteFill>
      <Footage clip={shot.clip} startFrom={shot.startFrom} push={0.15} dim={0.12} focusY={shot.focusY ?? 50} />
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.7) 0%, rgba(15,13,11,.36) 36%, rgba(15,13,11,0) 64%)'}} />
      <div style={{position: 'absolute', left: safe.left, right: v ? safe.right : safe.left, bottom: safe.bottom + (v ? 60 : 30) * u,
        display: 'flex', flexDirection: 'column', alignItems: v ? 'center' : 'flex-start', textAlign: v ? 'center' : 'left'}}>
        <div style={{...tracked(26 * u, 0.4), color: C.bone2, marginBottom: 22 * u, opacity: edge, minHeight: 30 * u}}>
          {shot.lead ?? ' '}
        </div>
        <WipeLine at={-2} dur={9}>
          <div style={{fontFamily: FONT.disp, fontSize: size, letterSpacing: '0.12em', color: C.bone, lineHeight: 1.1, textTransform: 'uppercase',
            textShadow: '0 2px 30px rgba(15,13,11,.8)', whiteSpace: 'nowrap'}}>
            {v ? <>ITS OWN<br />{shot.word}</> : <>ITS OWN {shot.word}</>}
          </div>
        </WipeLine>
        <div style={{marginTop: 30 * u, width: blockW, display: 'flex', flexDirection: 'column', alignItems: v ? 'center' : 'flex-start'}}>
          {shot.wave ? (
            <div style={{opacity: ramp(frame, 3, 9)}}><Wave width={Math.min(blockW, 560 * u)} frame={frame} color={C.bone} amp={14 * u} /></div>
          ) : (
            <div style={{width: Math.min(blockW, 560 * u) * ramp(frame, 3, 14), height: 2, background: shot.key, boxShadow: `0 0 14px ${shot.key}`}} />
          )}
          <div style={{...tracked(22 * u, 0.4), color: C.bone3, marginTop: 20 * u, opacity: edge}}>{shot.tag}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const RagaLightCrowd: FC = () => {
  const {durationInFrames} = useVideoConfig();
  const len = durationInFrames / 3; // three even shots (30/30/30 in 9:16, 40/40/40 in 16:9)
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      {SHOTS.map((s, i) => (
        <Sequence key={s.clip} from={Math.round(i * len)} durationInFrames={Math.round(len)}>
          <ShotView shot={s} len={len} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
