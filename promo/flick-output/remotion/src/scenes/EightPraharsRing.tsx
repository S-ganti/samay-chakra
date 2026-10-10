import type {FC} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, CHAPTERS, FONT} from '../lib/tokens';
import {Footage, Grain} from '../lib/Footage';
import {WipeLine} from '../lib/Type';
import {easeInOut, easeOut, ramp} from '../lib/motion';
import {ClockDigits, GATHERING_START, HeroDial, SHOT_FRAMES_CARRY, SWEEP_MINUTES, handDegAt, sfxVol, useHero} from './a_shared';

const SWEEP_AT = 8; // hand + arcs start (frame)
const PER_ARC = 6; // 0.2 s between arcs

export const EightPraharsRing: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: end} = useVideoConfig();
  const {v, u, cx, cy, size, height, safe} = useHero();

  const arcs = interpolate(frame, [SWEEP_AT, SWEEP_AT + PER_ARC * 8], [0, 8], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const handStart = SWEEP_MINUTES(1); // 17:59, exactly where scene 2 left the hand
  const deg = handDegAt(handStart + arcs * 180);
  const zoomAt = end - 9;
  const zoom = ramp(frame, zoomAt, end, easeInOut);
  const scale = 1 + 9 * zoom * zoom;
  const gone = 1 - ramp(frame, zoomAt - 2, zoomAt + 5, easeInOut);
  const handFade = 1 - ramp(frame, SWEEP_AT + PER_ARC * 8 - 2, SWEEP_AT + PER_ARC * 8 + 6);

  const R = size * 0.4; // ring radius
  const labelSize = (v ? 34 : 42) * u;
  const headSize = (v ? 62 : 66) * u;
  const dialTop = cy - size / 2;

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${cx}px ${cy}px, rgba(255,122,47,.05) 0%, rgba(15,13,11,0) 60%)`}} />
      <Grain opacity={0.07} />

      {/* the first shot of the next scene blooms behind the ring as it zooms through its centre */}
      <Sequence from={zoomAt - 1}>
        <div style={{opacity: ramp(frame, zoomAt + 1, end, easeOut), position: 'absolute', inset: 0}}>
          <Footage clip="s03_gathering" startFrom={Math.max(0, GATHERING_START - SHOT_FRAMES_CARRY)} push={0} dim={0.1} />
        </div>
      </Sequence>

      <div style={{position: 'absolute', left: safe.left, right: safe.right, bottom: height - dialTop + (v ? 112 : 96) * u,
        display: 'flex', justifyContent: 'center', textAlign: 'center', opacity: gone}}>
        <WipeLine at={1} dur={12}>
          <div style={{fontFamily: FONT.disp, fontSize: headSize, letterSpacing: '0.12em', lineHeight: 1.2, color: C.bone, textTransform: 'uppercase', textShadow: '0 2px 24px rgba(15,13,11,.7)'}}>
            {v ? (<>ANCIENT INDIA<br />SPLIT THE DAY<br />INTO <span style={{color: C.ember}}>8</span> PRAHARS</>)
               : (<>ANCIENT INDIA SPLIT THE DAY<br />INTO <span style={{color: C.ember}}>8</span> PRAHARS</>)}
          </div>
        </WipeLine>
      </div>

      <HeroDial
        spokes={1}
        arcs={arcs}
        deg={deg}
        handDraw={handFade}
        scale={scale}
        opacity={1}
        backing={0.42 * (1 - ramp(frame, 0, 10))}
      />

      {/* native-script names, each in its chapter colour, appearing as its arc lights */}
      <AbsoluteFill style={{opacity: gone}}>
        {CHAPTERS.map((c, i) => {
          const th = ((c.start / 24) * 360 + 22.5) * (Math.PI / 180); // arc mid-angle, clockwise from 12
          const s = Math.sin(th), k = Math.cos(th);
          // Malayalam "Brahma-muhurtham" is long; break it at the compound join so it stays inside the 9:16 safe area
          const cut = c.id === 'brahma' && v ? c.native.indexOf('\u0d2e\u0d41\u0d39') : -1;
          const lines = cut > 0 ? [c.native.slice(0, cut), c.native.slice(cut)] : [c.native];
          const p = ramp(frame, SWEEP_AT + PER_ARC * i + 3, SWEEP_AT + PER_ARC * i + 14);
          const rr = R + size * 0.075 + 18 * u + (1 - p) * -10 * u;
          const x = cx + s * rr, y = cy - k * rr;
          return (
            <div key={c.id} lang={c.lang} style={{
              position: 'absolute', left: x, top: y, whiteSpace: 'nowrap',
              transform: `translate(${-(50 - 50 * s)}%, ${-(50 + 50 * k)}%)`,
              textAlign: s > 0.3 ? 'left' : s < -0.3 ? 'right' : 'center', fontFamily: FONT.native, fontWeight: 500, fontSize: labelSize, lineHeight: 1.3, color: c.key, opacity: p,
              textShadow: '0 0 22px rgba(15,13,11,.9)',
            }}>{lines.map((ln, j) => <div key={j}>{ln}</div>)}</div>
          );
        })}
      </AbsoluteFill>

      {/* digits carried over from scene 2, then released */}
      <div style={{position: 'absolute', left: safe.left, right: safe.right, top: cy + size / 2 + (v ? 64 : 34) * u,
        display: 'flex', justifyContent: 'center', opacity: 1 - ramp(frame, 0, 8)}}>
        <ClockDigits minutes={1079} size={(v ? 150 : 120) * u} />
      </div>

      <Sequence from={SWEEP_AT}><Audio src={staticFile('sounds/Pop.mp3')} volume={sfxVol(-18)} /></Sequence>
      <Sequence from={SWEEP_AT + PER_ARC * 7}><Audio src={staticFile('sounds/Pop.mp3')} volume={sfxVol(-18)} /></Sequence>
    </AbsoluteFill>
  );
};
