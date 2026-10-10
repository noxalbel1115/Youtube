import React from 'react';
import {Composition} from 'remotion';
import type {Timeline} from '../schemas.js';
import {Episode, Thumbnail} from './Episode.js';
import {Scene3DPreview} from './Scene3DPreview.js';

// As props reais (timeline.json do episodio) sao passadas pelo renderizador.
const placeholder: Timeline = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 60,
  brand: {name: 'Departamento de Necessidades Desnecessárias', motto: 'Você não precisava. Até agora.', salesmanName: 'Vendedor', salesmanTitle: 'Cargo'},
  product: {name: 'Produto', brand: 'Marca'},
  beats: [
    {
      id: 'b1',
      startFrame: 0,
      durationFrames: 60,
      visual: {type: 'endcard', motion: 'static', layout: 'full', focus: {x: 0.5, y: 0.5}, zoom: 1, offsetY: 0, lowerThird: false, stampAt: 0.6},
      sfx: [],
      roomTone: false,
    },
  ],
  captions: [],
  credits: [],
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Episode"
      component={Episode as React.FC<any>}
      defaultProps={placeholder}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={60}
      calculateMetadata={({props}) => {
        const t = props as unknown as Timeline;
        return {durationInFrames: t.durationInFrames, fps: t.fps, width: t.width, height: t.height};
      }}
    />
    <Composition id="Scene3DPreview" component={Scene3DPreview} fps={30} width={1080} height={1920} durationInFrames={520} />
    <Composition id="Thumbnail" component={Thumbnail as React.FC<any>} defaultProps={placeholder} fps={30} width={1080} height={1920} durationInFrames={1} />
  </>
);
