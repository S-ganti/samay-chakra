import type {FC} from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

/** A one-shot SFX at scene frame `at`, gain in dB (volume = 10^(dB/20)). */
export const Sfx: FC<{file: string; at: number; db: number}> = ({file, at, db}) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(`sounds/${file}`)} volume={Math.pow(10, db / 20)} />
  </Sequence>
);

export const URL_TEXT = 's-ganti.github.io/samay-chakra';
