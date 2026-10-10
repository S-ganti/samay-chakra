import {useVideoConfig} from 'remotion';

/**
 * Layout helpers shared by both cuts. On 9:16 the platform UI covers the bottom ~20% (caption, buttons)
 * and the right ~12% (like/comment rail), so `safe` keeps text out of those zones.
 */
export const useFormat = () => {
  const {width, height, fps} = useVideoConfig();
  const v = height > width;
  const u = Math.min(width, height) / 1080; // 1 at 1080 short side
  const safe = v
    ? {top: height * 0.1, bottom: height * 0.22, left: width * 0.07, right: width * 0.14}
    : {top: height * 0.08, bottom: height * 0.1, left: width * 0.06, right: width * 0.06};
  return {width, height, fps, v, u, safe};
};
