import type {CSSProperties, FC, ReactNode} from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT, tracked} from './tokens';
import {easeOut, ramp} from './motion';

/** Text revealed by a left→right mask with a hairline leading edge (the house "wipe-in"). */
export const WipeLine: FC<{at: number; dur?: number; children: ReactNode; style?: CSSProperties; edge?: string}> = ({
  at, dur = 12, children, style, edge = C.bone,
}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + dur, easeOut);
  return (
    <div style={{position: 'relative', display: 'inline-block', ...style}}>
      <div style={{clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)`}}>{children}</div>
      {p > 0 && p < 1 && (
        <div style={{position: 'absolute', top: '-8%', bottom: '-8%', left: `${p * 100}%`, width: 2, background: edge, opacity: 0.9}} />
      )}
    </div>
  );
};

/** Letters rise out of a mask one by one (chapter titles). */
export const RiseLetters: FC<{text: string; at: number; stagger?: number; dur?: number; style?: CSSProperties}> = ({
  text, at, stagger = 1.2, dur = 16, style,
}) => {
  const frame = useCurrentFrame();
  return (
    <span style={{display: 'inline-block', whiteSpace: 'pre', ...style}}>
      {[...text].map((ch, i) => {
        const p = ramp(frame, at + i * stagger, at + i * stagger + dur, easeOut);
        return (
          <span key={i} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.08em'}}>
            <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 105}%)`, opacity: p > 0 ? 1 : 0}}>{ch}</span>
          </span>
        );
      })}
    </span>
  );
};

/** A thin rule that draws from the centre out. */
export const Hairline: FC<{at: number; width: number; dur?: number; color?: string; thickness?: number}> = ({
  at, width, dur = 14, color = C.hair2, thickness = 1.5,
}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + dur);
  return <div style={{width: width * p, height: thickness, background: color, margin: '0 auto'}} />;
};

/** The site's eyebrow: tiny, wide-tracked, bone-2. */
export const Eyebrow: FC<{children: ReactNode; size: number; style?: CSSProperties}> = ({children, size, style}) => (
  <div style={{...tracked(size, 0.36), color: C.bone2, ...style}}>{children}</div>
);

/** Statement line in Cinzel caps (hook lines, end card). */
export const Statement: FC<{children: ReactNode; size: number; style?: CSSProperties}> = ({children, size, style}) => (
  <div style={{fontFamily: FONT.disp, fontWeight: 400, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: C.bone, lineHeight: 1.18, textShadow: '0 2px 24px rgba(15,13,11,.55)', ...style}}>{children}</div>
);
