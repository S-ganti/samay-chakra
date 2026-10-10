import type {SceneDef} from '../lib/scenes';
import {CarvedStone} from './CarvedStone';
import {RealSky} from './RealSky';
import {RunsInBrowser} from './RunsInBrowser';
import {WhichPraharAreYou} from './WhichPraharAreYou';
// Scenes 15–18 (carved stone, real sky, runs in browser, end card). Owned by the group-C builder.
export const groupC: SceneDef[] = [
  {id: 'carved-stone', component: CarvedStone},
  {id: 'real-sky', component: RealSky},
  {id: 'runs-in-browser', component: RunsInBrowser},
  {id: 'which-prahar-are-you', component: WhichPraharAreYou},
];
