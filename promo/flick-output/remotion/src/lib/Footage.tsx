import type {FC} from 'react';
import {AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from './tokens';

/**
 * A captured website clip, full-bleed (object-fit cover crops the square capture to either aspect),
 * with a slow push-in so even a static shot breathes. `dim` darkens for text legibility.
 */
export const Footage: FC<{
  clip: string; // file stem in public/footage, e.g. 's02_enter'
  startFrom?: number; // frames into the clip
  push?: number; // total scale gain over the scene, e.g. 0.06
  dim?: number; // 0..1 ink overlay
  blur?: number; // px
  focusY?: number; // 0..100 object-position y
}> = ({clip, startFrom = 0, push = 0.06, dim = 0.18, blur = 0, focusY = 50}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const s = 1 + interpolate(frame, [0, durationInFrames], [0, push]);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
      <OffthreadVideo
        src={staticFile(`footage/${clip}.mp4`)}
        startFrom={startFrom}
        muted
        style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: `50% ${focusY}%`,
          transform: `scale(${s})`, filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
      {/* legibility: a soft vignette plus a flat dim, both in the site's ink */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, rgba(15,13,11,0) 40%, rgba(15,13,11,.55) 100%)`}} />
      <AbsoluteFill style={{backgroundColor: C.ink, opacity: dim}} />
    </AbsoluteFill>
  );
};

/** Fine film grain matching the site's grain pass; animated per frame, cheap SVG noise. */
export const Grain: FC<{opacity?: number}> = ({opacity = 0.07}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}>
      <svg width="100%" height="100%">
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 24} />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};
