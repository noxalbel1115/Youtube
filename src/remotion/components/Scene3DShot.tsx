import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {EggTopperScene} from './EggTopper3D.js';
import type {CueSeg} from '../track.js';
export {buildTrack} from '../track.js';

export const Scene3DShot: React.FC<{shotStart: number; track: CueSeg[]}> = ({shotStart, track}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: '#ECE8DF'}}>
      <ThreeCanvas width={width} height={height} shadows camera={{fov: 30, near: 0.05, far: 50}} gl={{antialias: true}}>
        <EggTopperScene absFrame={shotStart + frame} track={track} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
