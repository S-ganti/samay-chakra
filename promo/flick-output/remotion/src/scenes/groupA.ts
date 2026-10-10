import type {SceneDef} from '../lib/scenes';
import {HookNotAGame} from './HookNotAGame';
import {HookItsAClock} from './HookItsAClock';
import {EightPraharsRing} from './EightPraharsRing';
import {RagaLightCrowd} from './RagaLightCrowd';
import {IBuiltAllEight} from './IBuiltAllEight';
// Scenes 1–5 (hook → "I built all eight"). Owned by the group-A builder.
export const groupA: SceneDef[] = [
  {id: 'hook-not-a-game', component: HookNotAGame},
  {id: 'hook-its-a-clock', component: HookItsAClock},
  {id: 'eight-prahars-ring', component: EightPraharsRing},
  {id: 'raga-light-crowd', component: RagaLightCrowd},
  {id: 'i-built-all-eight', component: IBuiltAllEight},
];
