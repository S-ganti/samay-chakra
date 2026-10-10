import type React from 'react';
import type {FC} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Footage} from '../lib/Footage';
import {useFormat} from '../lib/format';
import {C, FONT} from '../lib/tokens';
import {ramp} from '../lib/motion';

// Footage offset into s02_enter (frames). Frame 0 must already be the full picture.
const START_FROM = 0;
// The strike-through lands on "GAME" at 1.0 s.
const STRIKE_AT = 30;

export const HookNotAGame: FC = () => {
  const frame = useCurrentFrame();
  const {v, u, safe, width, height} = useFormat();
  const size = (v ? 104 : 112) * u;
  const strike = ramp(frame, STRIKE_AT, STRIKE_AT + 7);
  const lines = v ? ['THIS ISN’T', 'A VIDEO', 'GAME.'] : ['THIS ISN’T A', 'VIDEO GAME.'];

  const statement: React.CSSProperties = {
    fontFamily: FONT.disp, fontWeight: 400, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: C.bone, lineHeight: 1.16, textShadow: '0 2px 28px rgba(15,13,11,.7)',
  };

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Footage clip="s02_enter" startFrom={START_FROM} push={0.07} dim={0.1} />
      {/* low ink wash so the statement reads on a bright portal */}
      <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(15,13,11,.62) 0%, rgba(15,13,11,.34) 34%, rgba(15,13,11,0) 62%)'}} />
      <div style={{
        position: 'absolute', left: safe.left, right: safe.right,
        bottom: v ? safe.bottom + 40 * u : safe.bottom + 20 * u,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        {lines.map((ln, i) => {
          const isGame = ln.includes('GAME');
          if (!isGame) return <div key={i} style={statement}>{ln}</div>;
          const [before, after] = ln.split('GAME');
          return (
            <div key={i} style={statement}>
              {before}
              <span style={{position: 'relative', display: 'inline-block', color: strike > 0.6 ? C.bone2 : C.bone}}>
                GAME
                <span style={{
                  position: 'absolute', left: -size * 0.06, right: -size * 0.02, top: '52%', height: Math.max(5, size * 0.06),
                  background: C.sindoor, transformOrigin: '0 50%', transform: `scaleX(${strike})`, boxShadow: '0 0 18px rgba(216,52,43,.7)',
                }} />
              </span>
              {after}
            </div>
          );
        })}
        <div style={{width: Math.min(width, height) * 0.5, height: 1.5, background: C.bone, opacity: 0.55, marginTop: 34 * u}} />
      </div>
    </AbsoluteFill>
  );
};
