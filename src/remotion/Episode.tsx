import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {Timeline, TimelineBeat} from '../schemas.js';
import {loadFonts} from './theme.js';
import {MediaFull, MediaExhibit, TitleCard, TextCard, FactSheet, EndCard} from './components/Visuals.js';
import {HeaderBand, LowerThird, Captions} from './components/Overlays.js';

loadFonts();

const ROOM_TONE_SECONDS = 120;
const ROOM_TONE_VOLUME = 0.55;

const BeatVisual: React.FC<{beat: TimelineBeat; t: Timeline}> = ({beat, t}) => {
  const v = beat.visual;
  switch (v.type) {
    case 'media':
      return v.layout === 'exhibit' ? <MediaExhibit beat={beat} /> : <MediaFull beat={beat} />;
    case 'title':
      return <TitleCard beat={beat} brandName={t.brand.name} />;
    case 'card':
      return <TextCard beat={beat} />;
    case 'factsheet':
      return <FactSheet beat={beat} />;
    case 'endcard':
      return <EndCard beat={beat} brandName={t.brand.name} motto={t.brand.motto} />;
    case 'black':
    default:
      return <AbsoluteFill style={{background: '#000'}} />;
  }
};

export const Episode: React.FC<Timeline> = (t) => {
  const {fps} = useVideoConfig();
  const caseLabel = 'PROTOCOLO 001';
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {t.beats.map((b) => (
        <Sequence key={b.id} from={b.startFrame} durationInFrames={b.durationFrames} name={b.id}>
          <BeatVisual beat={b} t={t} />
          {b.visual.type === 'media' ? <HeaderBand brandName={t.brand.name} caseLabel={caseLabel} /> : null}
          {b.visual.lowerThird ? <LowerThird name={t.brand.salesmanName} title={t.brand.salesmanTitle} durationFrames={b.durationFrames} /> : null}
        </Sequence>
      ))}

      <Captions captions={t.captions} />

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
        {beat.visual.type === 'media' ? <HeaderBand brandName={t.brand.name} caseLabel="PROTOCOLO 001" /> : null}
      </Sequence>
    </AbsoluteFill>
  );
};
