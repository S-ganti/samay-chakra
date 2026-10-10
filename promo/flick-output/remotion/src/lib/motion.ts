import {Easing, interpolate} from 'remotion';

// One easing family for the whole film: soft out, no overshoot (the site's UI never bounces).
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 between frames a and b with the house ease, clamped. */
export const ramp = (frame: number, a: number, b: number, ease = easeOut) =>
  interpolate(frame, [a, b], [0, 1], {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Fade in over `inF` frames from `a`, fade out over `outF` frames ending at `end`. */
export const inOut = (frame: number, a: number, inF: number, end: number, outF: number) =>
  Math.min(ramp(frame, a, a + inF), 1 - ramp(frame, end - outF, end, easeInOut));

export const sec = (s: number, fps = 30) => Math.round(s * fps);
