import type {FC} from 'react';
import {AbsoluteFill, Freeze, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, tracked} from '../lib/tokens';
import {easeInOut, easeOut, ramp} from '../lib/motion';
import {useFormat} from '../lib/format';
import {RingDial} from '../lib/RingDial';
import {Footage, Grain} from '../lib/Footage';
import {Hairline, RiseLetters, WipeLine} from '../lib/Type';
import {Sfx, URL_TEXT} from './c_common';

// The same startFrom the hook scene (scene 1) uses for s02_enter, so the loop lands on its first frame.
// Mirrors START_FROM in HookNotAGame.tsx (0 at the time of writing): keep the two in sync.
export const HOOK_START_FROM = 0;

const DRAW_END = 26; // ring + spokes finished drawing
const ARC_A = 14; // the 8 chapter colours sweep once around
const ARC_B = 32;
const DISSOLVE = 12; // last frames cross-dissolve into scene 1's first frame
const QUESTION_LEAD = 48; // the question owns the last ~1.6 s

export const WhichPraharAreYou: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const {v, u, width, height, safe} = useFormat();

  const q0 = dur - QUESTION_LEAD; // question starts replacing the URL
  const ringSize = (v ? 420 : 300) * u;
  const draw = ramp(frame, 0, DRAW_END, easeInOut);
  const spokes = ramp(frame, 8, DRAW_END);
  // chapter colours: one fast sweep 0→8, then settle back to a quiet ring
  const arcs = 8 * ramp(frame, ARC_A, ARC_B, easeInOut);
  const arcOpacity = 1 - 0.58 * ramp(frame, ARC_B + 4, ARC_B + 30, easeInOut);

  const urlIn = ramp(frame, 66, 80);
  const urlOut = ramp(frame, q0 - 6, q0 + 4, easeInOut);
  const dissolve = ramp(frame, dur - DISSOLVE - 1, dur - 1, easeInOut);

  const top = v ? 400 : 140;
  const word = (v ? 70 : 92) * u;
  const url = (v ? 36 : 36) * u;
  const qSize = (v ? 66 : 64) * u;
  const gap = (v ? 56 : 30) * u;

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Grain opacity={0.06} />
      {/* soft ember bloom behind the ring, from the site's vignette language */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% ${((top + ringSize / 2) / height) * 100}%, rgba(255,122,47,.10) 0%, rgba(255,122,47,0) 46%)`, opacity: ramp(frame, 6, 40)}} />

      <AbsoluteFill style={{alignItems: 'center', paddingTop: top, display: 'flex', flexDirection: 'column'}}>
        {/* the ring logo: line-drawn, then the 8 chapter colours flicker around it */}
        <div style={{position: 'relative', width: ringSize, height: ringSize}}>
          <div style={{position: 'absolute', inset: 0, opacity: arcOpacity}}>
            <RingDial size={ringSize} draw={0} spokes={0} arcs={arcs} arcWidth={5.5} />
          </div>
          <div style={{position: 'absolute', inset: 0}}>
            <RingDial size={ringSize} draw={draw} spokes={spokes} glow={0.35 * ramp(frame, DRAW_END - 4, DRAW_END + 10)} />
          </div>
        </div>

        <div style={{height: gap}} />
        <div style={{fontFamily: FONT.disp, fontSize: word, letterSpacing: '0.14em', color: C.bone, textTransform: 'uppercase', whiteSpace: 'nowrap',
          paddingLeft: '0.14em'}}>
          <RiseLetters text="SAMAY CHAKRA" at={DRAW_END + 2} stagger={1.3} />
        </div>
        <div style={{height: 18 * u}} />
        <WipeLine at={DRAW_END + 22} dur={16}>
          <div style={{...tracked((v ? 30 : 28) * u, 0.5), color: C.bone2, paddingLeft: '0.5em'}}>The Ring</div>
        </WipeLine>
        <div style={{height: 34 * u}} />
        <Hairline at={DRAW_END + 30} width={(v ? 300 : 360) * u} />
        <div style={{height: 38 * u}} />

        {/* URL, replaced in the last ~1.5 s by the question */}
        <div style={{position: 'relative', width: '100%', height: 190 * u}}>
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', opacity: urlIn * (1 - urlOut), transform: `translateY(${(1 - urlIn) * 10}px)`,
            fontFamily: FONT.sans, fontWeight: 400, fontSize: url, letterSpacing: '0.08em', color: C.bone}}>
            {URL_TEXT}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', top: -6 * u}}>
            <WipeLine at={q0 + 2} dur={14} style={{padding: '0 0.2em'}}>
              <div style={{fontFamily: FONT.disp, fontSize: qSize, letterSpacing: '0.12em', color: C.bone, lineHeight: 1.2, textTransform: 'uppercase',
                width: v ? 780 * u : undefined, paddingLeft: '0.12em'}}>
                Which prahar are you?
              </div>
            </WipeLine>
            <div style={{opacity: ramp(frame, q0 + 20, q0 + 30), marginTop: 22 * u, ...tracked(26 * u, 0.5), color: C.ember, paddingLeft: '0.5em'}}>
              comment below
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* loop: cross-dissolve to the first frame of scene 1 (frozen, so the last frame equals its frame 0) */}
      <Sequence from={dur - DISSOLVE - 1} layout="none">
        <AbsoluteFill style={{opacity: dissolve}}>
          <Freeze frame={0}>
            <Footage clip="s02_enter" startFrom={HOOK_START_FROM} push={0.07} dim={0.1} />
            {/* the same low ink wash HookNotAGame lays under its statement */}
            <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.62) 0%, rgba(15,13,11,.34) 34%, rgba(15,13,11,0) 62%)'}} />
          </Freeze>
        </AbsoluteFill>
      </Sequence>

      <Sfx file="Impact.mp3" at={DRAW_END + 2} db={-14} />
    </AbsoluteFill>
  );
};
