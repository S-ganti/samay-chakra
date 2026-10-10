import type {SceneDef} from '../lib/scenes';
import {PraharBrahma, PraharDiamond, PraharDispersal, PraharEclipse, PraharEnter, PraharGathering, PraharReturn, PraharZero} from './PraharCard';
import {PickAStyle} from './PickAStyle';

// Scenes 6–14 (eight prahar cards + pick-a-style). Owned by the group-B builder.
export const groupB: SceneDef[] = [
  {id: 'prahar-enter', component: PraharEnter},
  {id: 'prahar-gathering', component: PraharGathering},
  {id: 'prahar-eclipse', component: PraharEclipse},
  {id: 'prahar-brahma', component: PraharBrahma},
  {id: 'prahar-diamond', component: PraharDiamond},
  {id: 'prahar-dispersal', component: PraharDispersal},
  {id: 'prahar-zero', component: PraharZero},
  {id: 'prahar-return', component: PraharReturn},
  {id: 'pick-a-style', component: PickAStyle},
];
