import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {EggTopperScene, type CueSeg} from './components/EggTopper3D.js';

// Composicao de teste/estudio: todas as deixas em sequencia, para ajustar a cena 3D isoladamente.
export const PREVIEW_TRACK: CueSeg[] = [
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
];

export const Scene3DPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: '#ECE8DF'}}>
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 30, near: 0.05, far: 50}} gl={{antialias: true}}>
        <EggTopperScene absFrame={frame} track={PREVIEW_TRACK} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
