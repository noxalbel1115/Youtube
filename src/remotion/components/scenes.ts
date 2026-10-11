// Registro das cenas 3D proprias (type: "scene3d", campo "scene" do roteiro). Cada cena e uma funcao do quadro
// absoluto e da trilha de deixas; previewTrack alimenta a composicao de estudio Scene3DPreview-<cena>.
import type React from 'react';
import type {CueSeg} from '../track.js';
import {EggTopperScene} from './EggTopper3D.js';
import {TrouserPressScene, BG as TROUSER_PRESS_BG} from './TrouserPress3D.js';

export interface SceneDef {
  component: React.FC<{absFrame: number; track: CueSeg[]}>;
  background: string;
  previewTrack: CueSeg[];
}

export const DEFAULT_SCENE = 'egg-topper';

export const SCENES: Record<string, SceneDef> = {
  'egg-topper': {
    component: EggTopperScene,
    background: '#ECE8DF',
    previewTrack: [
      {cue: 'hero', start: 0, end: 90},
      {cue: 'place', start: 90, end: 150},
      {cue: 'lift', start: 150, end: 180},
      {cue: 'drop', start: 180, end: 200, impact: 196},
      {cue: 'hold', start: 200, end: 230},
      {cue: 'open', start: 230, end: 300},
      {cue: 'gem', start: 300, end: 360},
      {cue: 'gemClose', start: 360, end: 390},
      {cue: 'gemEgg', start: 390, end: 430},
      {cue: 'still', start: 430, end: 470},
      {cue: 'snap', start: 470, end: 520},
    ],
  },
  'trouser-press': {
    component: TrouserPressScene,
    background: TROUSER_PRESS_BG,
    previewTrack: [
      {cue: 'hero', start: 0, end: 75},
      {cue: 'open', start: 75, end: 120},
      {cue: 'insert', start: 120, end: 165},
      {cue: 'close', start: 165, end: 200},
      {cue: 'c15', start: 200, end: 230},
      {cue: 'c30', start: 230, end: 260},
      {cue: 'c45', start: 260, end: 290},
      {cue: 'run', start: 290, end: 350},
      {cue: 'finish', start: 350, end: 470},
      {cue: 'bathroom', start: 470, end: 580},
      {cue: 'still', start: 580, end: 640},
      {cue: 'snap', start: 640, end: 690},
      {cue: 'iron', start: 690, end: 750},
    ],
  },
};
