import React from 'react';
import {interpolate, Easing, useCurrentFrame} from 'remotion';
import type {CaptionChunk} from '../../schemas.js';
import {C, SANS, MONO, SAFE} from '../theme.js';

/** Faixa institucional discreta no topo (abaixo da interface do YouTube). */
export const HeaderBand: React.FC<{brandName: string; caseLabel: string}> = ({brandName, caseLabel}) => (
  <div
    style={{
      position: 'absolute',
      top: SAFE.top - 20,
      left: 0,
      right: 0,
      height: 62,
      background: 'rgba(236,232,223,0.93)',
      borderBottom: `2px solid ${C.ink}`,
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${SAFE.left}px`,
      gap: 18,
      color: C.ink,
    }}
  >
    <div style={{border: `3px solid ${C.ink}`, fontFamily: SANS, fontWeight: 700, fontSize: 22, padding: '2px 8px', letterSpacing: 1}}>DND</div>
    <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 19, letterSpacing: 1.6, textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap'}}>{brandName}</div>
    <div style={{fontFamily: MONO, fontSize: 19, color: C.inkSoft}}>{caseLabel}</div>
  </div>
);

/** Etiqueta do entrevistado, estilo documentario. */
export const LowerThird: React.FC<{name: string; title: string; durationFrames: number}> = ({name, title, durationFrames}) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [6, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const outP = interpolate(frame, [durationFrames - 12, durationFrames - 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const x = interpolate(inP, [0, 1], [-60, 0]);
  const o = inP * (1 - outP);
  return (
    <div style={{position: 'absolute', left: SAFE.left, top: 1010, opacity: o, transform: `translateX(${x}px)`}}>
      <div style={{background: C.white, color: C.ink, fontFamily: SANS, fontWeight: 700, fontSize: 46, padding: '12px 24px 10px', display: 'inline-block'}}>{name}</div>
      <div />
      <div style={{background: C.ink, color: C.paper, fontFamily: SANS, fontWeight: 500, fontSize: 30, padding: '10px 24px', display: 'inline-block', letterSpacing: 0.5}}>{title}</div>
    </div>
  );
};

/**
 * Legendas: no maximo 2 linhas, dentro da zona segura (acima da faixa de titulo do Short e
 * a esquerda da coluna de botoes). Falas da colega (fora de quadro) em italico e cor distinta.
 */
export const Captions: React.FC<{captions: CaptionChunk[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const cur = captions.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cur) return null;
  const offscreen = cur.speaker === 'colega';
  return (
    <div style={{position: 'absolute', left: 90, width: 820, top: 1290, height: 190, display: 'flex', alignItems: 'flex-start', justifyContent: 'center'}}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 600,
          fontStyle: offscreen ? 'italic' : 'normal',
          fontSize: 62,
          lineHeight: 1.18,
          textAlign: 'center',
          color: offscreen ? '#FFE7A3' : C.white,
          WebkitTextStroke: '10px rgba(10,12,18,0.92)',
          paintOrder: 'stroke fill',
          textShadow: '0 3px 10px rgba(0,0,0,0.35)',
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};
