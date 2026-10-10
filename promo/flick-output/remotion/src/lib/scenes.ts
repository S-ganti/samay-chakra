import type {FC} from 'react';
import transcript from '../../../transcript.json';

export type SceneDef = {id: string; component: FC};
type Seg = {id: string; text: string; start: number; end: number};

const t = transcript as unknown as {segments: Seg[]; segments_16x9: Seg[]};
const FPS = 30;
const frames = (s?: Seg) => (s ? Math.round((s.end - s.start) * FPS) : 0);

/** Transcript-derived scene length in frames for each cut (0 = scene not in that cut). */
export const durationOf = (id: string) => ({
  v: frames(t.segments.find((s) => s.id === id)),
  h: frames(t.segments_16x9.find((s) => s.id === id)),
});
export const ORDER = t.segments_16x9.map((s) => s.id);
