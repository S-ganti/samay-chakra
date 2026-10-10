import type {FC} from 'react';
import {useFormat} from './format';
import {RingDial} from './RingDial';

/**
 * The docked progress dial that rides through the montage (scenes 5–13, 16). One fixed position and size
 * for every scene so the hard cuts between scenes never make it jump.
 */
export const CORNER = (v: boolean, u: number, width: number, height: number) => {
  const size = (v ? 150 : 120) * u;
  // 9:16: top-left inside the safe area (the right rail and bottom are covered by platform UI)
  return v ? {x: width * 0.07, y: height * 0.1, size} : {x: width * 0.05, y: height * 0.07, size};
};

export const CornerDial: FC<{arcs: number; pulse?: number; opacity?: number; label?: string}> = ({arcs, pulse = 0, opacity = 1}) => {
  const {v, u, width, height} = useFormat();
  const c = CORNER(v, u, width, height);
  return (
    <div style={{position: 'absolute', left: c.x, top: c.y, width: c.size, height: c.size, opacity}}>
      <RingDial size={c.size} arcs={arcs} arcWidth={7} spokes={0.5} pulse={pulse} glow={0.4} />
    </div>
  );
};
