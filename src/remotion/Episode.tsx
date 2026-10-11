import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {Timeline, TimelineBeat} from '../schemas.js';
import {loadFonts} from './theme.js';
import {MediaFull, MediaExhibit, TitleCard, TextCard, FactSheet, EndCard} from './components/Visuals.js';
import {HeaderBand, LowerThird, Captions, FigureLabel} from './components/Overlays.js';
import {Scene3DShot, buildTrack} from './components/Scene3DShot.js';

loadFonts();

const ROOM_TONE_SECONDS = 120;
const ROOM_TONE_VOLUME = 0.55;

const BeatVisual: React.FC<{beat: TimelineBeat; t: Timeline}> = ({beat, t}) => {
  const v = beat.visual;
  switch (v.type) {
    case 'scene3d':
      // A trilha de deixas considera so os beats da mesma cena 3D (um episodio pode ter mais de uma).
      return <Scene3DShot scene={v.scene} shotStart={beat.startFrame} track={buildTrack(t.beats.filter((b) => b.visual.scene === v.scene))} />;
    case 'media':
      return v.layout === 'exhibit' ? <MediaExhibit beat={beat} /> : <MediaFull beat={beat} />;
    case 'title':
      return <TitleCard beat={beat} brandName={t.brand.name} ui={t.ui} />;
    case 'card':
      return <TextCard beat={beat} />;
    case 'factsheet':
      return <FactSheet beat={beat} label={t.ui.factsheetLabel} />;
    case 'endcard':
      return <EndCard beat={beat} brandName={t.brand.name} motto={t.brand.motto} ui={t.ui} />;
    case 'black':
    default:
      return <AbsoluteFill style={{background: '#000'}} />;
  }
};

/** Campos que so afetam sobreposicoes (etiqueta, credito) ou deixas da cena 3D nao quebram o plano. */
function shotKey(b: TimelineBeat): string {
  const {cue: _c, lowerThird: _l, label: _lb, ...rest} = b.visual;
  return JSON.stringify(rest) + (b.mediaFile ?? '');
}

/**
 * Beats consecutivos com o mesmo visual viram um unico plano: a imagem fica parada (ou o movimento
 * continua) enquanto as falas se sucedem, como num plano sustentado de documentario.
 */
export function groupVisuals(beats: TimelineBeat[]): TimelineBeat[] {
  const out: TimelineBeat[] = [];
  let prevKey = '';
  for (const b of beats) {
    const key = shotKey(b);
    const prev = out[out.length - 1];
    if (prev && key === prevKey) out[out.length - 1] = {...prev, durationFrames: prev.durationFrames + b.durationFrames};
    else out.push({...b});
    prevKey = key;
  }
  return out;
}

const hasHeader = (b: TimelineBeat) => b.visual.type === 'media' || b.visual.type === 'scene3d';

export const Episode: React.FC<Timeline> = (t) => {
  const {fps} = useVideoConfig();
  const caseLabel = t.ui.caseLabel;
  const shots = groupVisuals(t.beats);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {shots.map((b) => (
        <Sequence key={b.id} from={b.startFrame} durationInFrames={b.durationFrames} name={`plano ${b.id}`}>
          <BeatVisual beat={b} t={t} />
          {hasHeader(b) ? <HeaderBand brandName={t.brand.name} caseLabel={caseLabel} mark={t.ui.sealText} /> : null}
        </Sequence>
      ))}
      {/* Sobreposicoes por beat (nao por plano): credito/rotulo e etiqueta do vendedor. */}
      {t.beats.map((b) => {
        const label = b.visual.label && (b.visual.type === 'scene3d' || (b.visual.type === 'media' && b.visual.layout === 'full'));
        return label || b.visual.lowerThird ? (
          <Sequence key={`o-${b.id}`} from={b.startFrame} durationInFrames={b.durationFrames} name={`sobreposicao ${b.id}`}>
            {label ? <FigureLabel text={b.visual.label!} /> : null}
            {b.visual.lowerThird ? <LowerThird name={t.brand.salesmanName} title={t.brand.salesmanTitle} durationFrames={b.durationFrames} /> : null}
          </Sequence>
        ) : null;
      })}

      <Captions
        captions={t.captions}
        paperRanges={shots
          .filter((b) => ['card', 'factsheet', 'title'].includes(b.visual.type) || (b.visual.type === 'media' && b.visual.layout === 'exhibit'))
          .map((b) => [b.startFrame, b.startFrame + b.durationFrames])}
      />

      {/* Audio: falas, efeitos e ambiente de sala (o "silencio" do escritorio nunca e silencio digital). */}
      {t.beats.map((b) =>
        b.audio ? (
          <Sequence key={`a-${b.id}`} from={b.audio.startFrame} durationInFrames={b.audio.durationFrames + 2} name={`fala ${b.id}`}>
            <Html5Audio src={staticFile(b.audio.file)} />
          </Sequence>
        ) : null,
      )}
      {t.beats.flatMap((b) =>
        b.sfx.map((s, i) => (
          <Sequence key={`s-${b.id}-${i}`} from={s.frame} durationInFrames={fps * 2} name={`sfx ${b.id}`}>
            <Html5Audio src={staticFile(s.file)} volume={s.volume} />
          </Sequence>
        )),
      )}
      {t.roomToneFile
        ? t.beats
            .filter((b) => b.roomTone)
            .map((b) => (
              <Sequence key={`r-${b.id}`} from={b.startFrame} durationInFrames={b.durationFrames} name={`sala ${b.id}`}>
                <Html5Audio src={staticFile(t.roomToneFile!)} trimBefore={b.startFrame % (ROOM_TONE_SECONDS * fps - b.durationFrames)} volume={ROOM_TONE_VOLUME} />
              </Sequence>
            ))
        : null}
    </AbsoluteFill>
  );
};

/** Miniatura vertical: um quadro do episodio sem legendas, com o titulo em destaque. */
export const Thumbnail: React.FC<Timeline & {thumbnailFrame?: number; thumbnailText?: string}> = (t) => {
  const frame = t.thumbnailFrame ?? 0;
  const beat = t.beats.find((b) => frame >= b.startFrame && frame < b.startFrame + b.durationFrames) ?? t.beats[0];
  return (
    <AbsoluteFill>
      <Sequence from={-(frame - beat.startFrame)} durationInFrames={beat.durationFrames}>
        <BeatVisual beat={beat} t={t} />
        {hasHeader(beat) ? <HeaderBand brandName={t.brand.name} caseLabel={t.ui.caseLabel} mark={t.ui.sealText} /> : null}
      </Sequence>
      {t.thumbnailText ? (
        <div style={{position: 'absolute', left: 64, right: 150, top: 1180, display: 'flex'}}>
          <div style={{background: 'rgba(236,232,223,0.95)', color: '#1C2333', fontFamily: 'IBM Plex Sans', fontWeight: 700, fontSize: 74, lineHeight: 1.08, padding: '22px 30px', borderLeft: '12px solid #A63A2B'}}>
            {t.thumbnailText}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
