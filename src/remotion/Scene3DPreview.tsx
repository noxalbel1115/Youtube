import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {SCENES} from './components/scenes.js';

// Composicao de teste/estudio: todas as deixas de uma cena em sequencia, para ajusta-la isoladamente.
export const Scene3DPreview: React.FC<{scene: string}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const def = SCENES[scene];
  const Scene = def.component;
  return (
    <AbsoluteFill style={{background: def.background}}>
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 30, near: 0.05, far: 50}} gl={{antialias: true}}>
        <Scene absFrame={frame} track={def.previewTrack} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
