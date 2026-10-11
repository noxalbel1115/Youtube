import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {SCENES, DEFAULT_SCENE} from './scenes.js';
import type {CueSeg} from '../track.js';
export {buildTrack} from '../track.js';

export const Scene3DShot: React.FC<{scene?: string; shotStart: number; track: CueSeg[]}> = ({scene, shotStart, track}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const def = SCENES[scene ?? DEFAULT_SCENE];
  if (!def) throw new Error(`Cena 3D desconhecida: ${scene}. Disponiveis: ${Object.keys(SCENES).join(', ')}`);
  const Scene = def.component;
  return (
    <AbsoluteFill style={{background: def.background}}>
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 30, near: 0.05, far: 50}} gl={{antialias: true}}>
        <Scene absFrame={shotStart + frame} track={track} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
