import type {FC} from 'react';
import {Composition} from 'remotion';
import {ORDER, durationOf, type SceneDef} from './lib/scenes';
import {groupA} from './scenes/groupA';
import {groupB} from './scenes/groupB';
import {groupC} from './scenes/groupC';

// One Composition per approved scene and format (`<id>-v` 1080×1920, `<id>-h` 1920×1080).
// No all-scenes composition: the cut is assembled with ffmpeg (promo/assemble).
const ALL: SceneDef[] = [...groupA, ...groupB, ...groupC].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

export const RemotionRoot: FC = () => (
  <>
    {ALL.flatMap(({id, component}) => {
      const d = durationOf(id);
      return [
        d.v > 0 && <Composition key={id + '-v'} id={id + '-v'} component={component} durationInFrames={d.v} fps={30} width={1080} height={1920} />,
        d.h > 0 && <Composition key={id + '-h'} id={id + '-h'} component={component} durationInFrames={d.h} fps={30} width={1920} height={1080} />,
      ].filter(Boolean);
    })}
  </>
);
