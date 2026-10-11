// Registro das cenas 3D proprias (type: "scene3d", campo "scene" do roteiro). Cada cena e uma funcao do quadro
// absoluto e da trilha de deixas; previewTrack alimenta a composicao de estudio Scene3DPreview-<cena>.
import type React from 'react';
import type {CueSeg} from '../track.js';
import {EggTopperScene} from './EggTopper3D.js';

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
};
