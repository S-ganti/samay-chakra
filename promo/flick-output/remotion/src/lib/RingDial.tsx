import type {FC} from 'react';
import {CHAPTERS, C} from './tokens';

/**
 * The ring motif from the site's favicon (outer circle, hub, 8 spokes), extended into the 8-prahar dial.
 * Everything is driven by props so scenes animate it with frame-derived values.
 *
 * Geometry: 12 o'clock is 00:00 like a clock face; each prahar arc spans 45° starting at its start hour.
 */
export const RingDial: FC<{
  size: number;
  draw?: number; // 0..1 line-draw of circle + hub + spokes
  spokes?: number; // 0..1 opacity of the 8 spokes
  arcs?: number; // 0..8 how many prahar arcs are lit, fractional = partial fill of the next (clockwise from dusk)
  arcWidth?: number; // stroke width of the arcs, in viewBox units (100)
  hand?: number | null; // hour 0..24 for a clock hand, or null
  pulse?: number; // 0..1 beat pulse ring
  color?: string; // line colour
  glow?: number; // 0..1
}> = ({size, draw = 1, spokes = 1, arcs = 0, arcWidth = 4.2, hand = null, pulse = 0, color = C.ember, glow = 0}) => {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const arcLen = circ / 8;
  const gap = 1.1; // visual gap between arcs, viewBox units along the circumference
  const handA = hand === null ? 0 : (hand / 24) * 360;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${6 * glow}px ${color})` : undefined}}>
      {/* prahar arcs: drawn as dash segments on the same circle; 18:00 (Enter) first */}
      {CHAPTERS.map((c, i) => {
        const fill = Math.max(0, Math.min(1, arcs - i));
        if (fill <= 0) return null;
        const startDeg = (c.start / 24) * 360 - 90; // svg 0° = 3 o'clock
        return (
          <circle
            key={c.id}
            cx={50} cy={50} r={r} fill="none" stroke={c.key} strokeWidth={arcWidth}
            strokeDasharray={`${Math.max(0, (arcLen - gap) * fill)} ${circ}`}
            transform={`rotate(${startDeg + (gap / circ) * 180} 50 50)`}
            strokeLinecap="butt"
          />
        );
      })}
      {/* outer ring + hub, line-drawn */}
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={1.4}
        strokeDasharray={`${circ * draw} ${circ}`} transform="rotate(-90 50 50)" />
      <circle cx={50} cy={50} r={6} fill="none" stroke={color} strokeWidth={1.4}
        strokeDasharray={`${2 * Math.PI * 6 * draw} 100`} transform="rotate(-90 50 50)" />
      <g stroke={color} strokeWidth={0.9} opacity={spokes}>
        {[0, 45, 90, 135].map((a) => {
          const rad = (a * Math.PI) / 180;
          const dx = Math.cos(rad) * (r - 1) * draw, dy = Math.sin(rad) * (r - 1) * draw;
          return <line key={a} x1={50 - dx} y1={50 - dy} x2={50 + dx} y2={50 + dy} />;
        })}
      </g>
      <circle cx={50} cy={50} r={1.6} fill={color} opacity={draw} />
      {hand !== null && (
        <line x1={50} y1={50} x2={50} y2={50 - r + 4} stroke={C.bone} strokeWidth={1.6} strokeLinecap="round"
          transform={`rotate(${handA} 50 50)`} />
      )}
      {pulse > 0 && (
        <circle cx={50} cy={50} r={r + 6 * pulse} fill="none" stroke={color} strokeWidth={0.8} opacity={1 - pulse} />
      )}
    </svg>
  );
};
