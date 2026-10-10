import React from 'react';
import {AbsoluteFill, Img, interpolate, Easing, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {TimelineBeat} from '../../schemas.js';
import {C, SANS, MONO, SAFE} from '../theme.js';

const ease = Easing.bezier(0.33, 0, 0.67, 1);

/** Escala e posicao de uma foto conforme o movimento de camera pedido, mantendo o quadro coberto. */
function useCamera(beat: TimelineBeat, boxW: number, boxH: number) {
  const frame = useCurrentFrame();
  const {w, h} = beat.mediaSize!;
  const {motion, focus, zoom} = beat.visual;
  const dur = Math.max(1, beat.durationFrames - 1);
  const base = Math.max(boxW / w, boxH / h);
  const p = interpolate(frame, [0, dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  let s = base * zoom;
  let fx = focus.x;
  let fy = focus.y;
  switch (motion) {
    case 'push-in':
      s = base * interpolate(p, [0, 1], [1, zoom]);
      break;
    case 'pull-out':
      s = base * interpolate(p, [0, 1], [zoom, 1]);
      break;
    case 'pan-left':
      fx = interpolate(p, [0, 1], [focus.x + 0.12, focus.x - 0.12]);
      break;
    case 'pan-right':
      fx = interpolate(p, [0, 1], [focus.x - 0.12, focus.x + 0.12]);
      break;
    case 'snap-in': {
      // "Zoom de reacao" do falso documentario: 5 quadros rapidos e para.
      const q = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
      s = base * interpolate(q, [0, 1], [1, zoom]);
      break;
    }
    case 'drift':
      s = base * interpolate(p, [0, 1], [zoom, zoom + 0.04]);
      fy = interpolate(p, [0, 1], [focus.y + 0.02, focus.y - 0.02]);
      break;
    case 'static':
    default:
      break;
  }
  const sw = w * s;
  const sh = h * s;
  const x = Math.min(0, Math.max(boxW - sw, boxW / 2 - fx * sw));
  const y0 = Math.min(0, Math.max(boxH - sh, boxH / 2 - fy * sh));
  const off = beat.visual.offsetY ?? 0;
  const y = off > 0 ? Math.min(off, Math.max(boxH - sh, y0 + off)) : y0;
  return {sw, sh, x, y};
}

const Photo: React.FC<{beat: TimelineBeat; boxW: number; boxH: number}> = ({beat, boxW, boxH}) => {
  const {sw, sh, x, y} = useCamera(beat, boxW, boxH);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: beat.visual.bg ?? C.ink}}>
      <Img src={staticFile(beat.mediaFile!)} style={{position: 'absolute', left: x, top: y, width: sw, height: sh}} />
    </div>
  );
};

export const MediaFull: React.FC<{beat: TimelineBeat}> = ({beat}) => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill>
      <Photo beat={beat} boxW={width} boxH={height} />
      {/* Vinheta leve para dar leitura as legendas, sem escurecer o produto */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)'}} />
    </AbsoluteFill>
  );
};

export const MediaExhibit: React.FC<{beat: TimelineBeat}> = ({beat}) => {
  const {width} = useVideoConfig();
  const panelW = width - 2 * SAFE.left;
  const {w, h} = beat.mediaSize!;
  const panelH = Math.min(1000, Math.round(panelW * (h / w)));
  return (
    <AbsoluteFill style={{background: C.paper}}>
      <PaperTexture />
      <div style={{position: 'absolute', left: SAFE.left, top: 330, width: panelW, height: panelH, border: `10px solid ${C.white}`, boxShadow: '0 6px 18px rgba(28,35,51,0.18)', overflow: 'hidden'}}>
        <div style={{position: 'relative', width: panelW - 20, height: panelH - 20}}>
          <Photo beat={beat} boxW={panelW - 20} boxH={panelH - 20} />
        </div>
      </div>
      {beat.visual.label ? (
        <div style={{position: 'absolute', left: SAFE.left, top: 330 + panelH + 22, width: panelW, fontFamily: MONO, fontSize: 30, color: C.inkSoft, letterSpacing: 0.5}}>
          {beat.visual.label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Movimento lento sobre documentos (aproximacao de camera sobre a cartela). */
function useCardScale(beat: TimelineBeat): number {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, beat.durationFrames - 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  if (beat.visual.motion === 'push-in') return interpolate(p, [0, 1], [1, 1.07]);
  if (beat.visual.motion === 'drift') return interpolate(p, [0, 1], [1, 1.025]);
  return 1;
}

/** Linhas de pauta discretas: papel de reparticao. */
export const PaperTexture: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(0deg, rgba(196,189,174,0.22) 0px, rgba(196,189,174,0.22) 1px, transparent 1px, transparent 64px)`,
    }}
  />
);

export const Seal: React.FC<{size?: number; color?: string}> = ({size = 120, color = C.ink}) => (
  <div style={{width: size, height: size, border: `${Math.max(3, size / 28)}px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color, fontFamily: SANS}}>
    <div style={{fontWeight: 700, fontSize: size * 0.34, letterSpacing: size * 0.02, lineHeight: 1}}>DND</div>
    <div style={{fontFamily: MONO, fontSize: size * 0.1, marginTop: size * 0.06, letterSpacing: 1}}>DEPTO. 001</div>
  </div>
);

export const Stamp: React.FC<{text: string; atFrame: number; top?: number}> = ({text, atFrame, top = 1120}) => {
  const frame = useCurrentFrame();
  if (frame < atFrame) return null;
  const k = interpolate(frame - atFrame, [0, 4], [1.35, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  const o = interpolate(frame - atFrame, [0, 2], [0, 0.9], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', top, left: 0, right: 150, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          transform: `rotate(-7deg) scale(${k})`,
          opacity: o,
          border: `8px solid ${C.stamp}`,
          color: C.stamp,
          padding: '14px 34px',
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 68,
          letterSpacing: 6,
          textTransform: 'uppercase',
          mixBlendMode: 'multiply',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const TitleCard: React.FC<{beat: TimelineBeat; brandName: string}> = ({beat, brandName}) => {
  const {fps} = useVideoConfig();
  const v = beat.visual;
  return (
    <AbsoluteFill style={{background: C.paper}}>
      <PaperTexture />
      <div style={{position: 'absolute', left: SAFE.left, right: 150, top: 300, color: C.ink, fontFamily: SANS}}>
        <Seal size={130} />
        <div style={{marginTop: 44, fontSize: 34, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', lineHeight: 1.3}}>{brandName}</div>
        <div style={{height: 4, background: C.ink, margin: '30px 0 26px', width: 260}} />
        {v.footnote ? <div style={{fontFamily: MONO, fontSize: 32, color: C.inkSoft}}>{v.footnote}</div> : null}
        {v.heading ? <div style={{marginTop: 80, fontSize: 84, fontWeight: 700, lineHeight: 1.05, hyphens: 'manual', overflowWrap: 'anywhere'}}>{v.heading}</div> : null}
        {v.body ? <div style={{marginTop: 30, fontSize: 42, color: C.inkSoft, lineHeight: 1.3}}>{v.body}</div> : null}
      </div>
      {v.stamp ? <Stamp text={v.stamp} atFrame={Math.round(v.stampAt * fps)} top={1260} /> : null}
    </AbsoluteFill>
  );
};

export const TextCard: React.FC<{beat: TimelineBeat}> = ({beat}) => {
  const {fps} = useVideoConfig();
  const scale = useCardScale(beat);
  const v = beat.visual;
  return (
    <AbsoluteFill style={{background: C.paper}}>
      <PaperTexture />
      <div style={{position: 'absolute', left: SAFE.left, right: 150, top: 560, color: C.ink, fontFamily: SANS, transform: `scale(${scale})`, transformOrigin: '0% 30%'}}>
        {v.heading ? <div style={{fontSize: 76, fontWeight: 700, lineHeight: 1.1, hyphens: 'manual', overflowWrap: 'anywhere'}}>{v.heading}</div> : null}
        {v.body ? <div style={{marginTop: 34, fontSize: 44, color: C.inkSoft, lineHeight: 1.35, whiteSpace: 'pre-line'}}>{v.body}</div> : null}
        {v.footnote ? <div style={{marginTop: 50, fontFamily: MONO, fontSize: 28, color: C.muted, lineHeight: 1.4}}>{v.footnote}</div> : null}
      </div>
      {v.stamp ? <Stamp text={v.stamp} atFrame={Math.round(v.stampAt * fps)} /> : null}
    </AbsoluteFill>
  );
};

/** Ficha tecnica: linhas "Rotulo: valor" no body; fonte e data no footnote. */
export const FactSheet: React.FC<{beat: TimelineBeat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = useCardScale(beat);
  const v = beat.visual;
  const rows = (v.body ?? '').split('\n').filter(Boolean).map((r) => {
    const i = r.indexOf(':');
    return i > 0 ? [r.slice(0, i).trim(), r.slice(i + 1).trim()] : ['', r.trim()];
  });
  return (
    <AbsoluteFill style={{background: C.paper}}>
      <PaperTexture />
      <div style={{position: 'absolute', left: SAFE.left, right: 150, top: 340, color: C.ink, fontFamily: SANS, transform: `scale(${scale})`, transformOrigin: '0% 30%'}}>
        <div style={{fontFamily: MONO, fontSize: 30, letterSpacing: 4, color: C.inkSoft}}>FICHA TÉCNICA</div>
        <div style={{fontSize: 60, fontWeight: 700, marginTop: 12, lineHeight: 1.1, hyphens: 'manual', overflowWrap: 'anywhere'}}>{v.heading}</div>
        <div style={{height: 3, background: C.ink, margin: '30px 0 10px'}} />
        {rows.map(([k, val], i) => {
          // Cada linha entra em sequencia, como quem le a ficha.
          const o = interpolate(frame, [6 + i * 8, 12 + i * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={i} style={{opacity: o, display: 'flex', borderBottom: `2px solid ${C.rule}`, padding: '22px 0', gap: 24}}>
              <div style={{width: 270, flexShrink: 0, fontFamily: MONO, fontSize: 30, color: C.muted, textTransform: 'uppercase', paddingTop: 6}}>{k}</div>
              <div style={{fontSize: 40, fontWeight: 500, lineHeight: 1.25}}>{val}</div>
            </div>
          );
        })}
        {v.footnote ? <div style={{marginTop: 30, fontFamily: MONO, fontSize: 24, color: C.muted, lineHeight: 1.45}}>{v.footnote}</div> : null}
      </div>
      {v.stamp ? <Stamp text={v.stamp} atFrame={Math.round(v.stampAt * fps)} top={1300} /> : null}
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{beat: TimelineBeat; brandName: string; motto: string}> = ({beat, brandName, motto}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: C.ink, color: C.paper, fontFamily: SANS}}>
      <div style={{position: 'absolute', left: SAFE.left, right: 150, top: 470, opacity: o}}>
        <Seal size={150} color={C.paper} />
        <div style={{marginTop: 50, fontSize: 38, fontWeight: 600, letterSpacing: 5, textTransform: 'uppercase', lineHeight: 1.3}}>{brandName}</div>
        <div style={{height: 4, background: C.paper, margin: '34px 0', width: 260, opacity: 0.8}} />
        <div style={{fontSize: 70, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15}}>{beat.visual.heading ?? motto}</div>
        {beat.visual.footnote ? <div style={{marginTop: 60, fontFamily: MONO, fontSize: 28, opacity: 0.75, lineHeight: 1.4}}>{beat.visual.footnote}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
