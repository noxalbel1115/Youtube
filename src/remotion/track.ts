import type {TimelineBeat} from '../schemas.js';

/** Trecho da trilha de deixas de uma cena 3D, em quadros absolutos do episodio. */
export interface CueSeg {
  cue: string;
  start: number;
  end: number;
  impact?: number;
}

/**
 * Trilha de deixas de TODOS os beats 3D do episodio. Beats consecutivos com a mesma deixa viram um
 * trecho so. Na deixa "drop", o impacto e o primeiro efeito sonoro do beat (o "clack").
 */
export function buildTrack(beats: TimelineBeat[]): CueSeg[] {
  const track: CueSeg[] = [];
  for (const b of beats) {
    if (b.visual.type !== 'scene3d' || !b.visual.cue) continue;
    const end = b.startFrame + b.durationFrames;
    const last = track[track.length - 1];
    if (last && last.cue === b.visual.cue && last.end === b.startFrame) last.end = end;
    else track.push({cue: b.visual.cue, start: b.startFrame, end});
    if (b.visual.cue === 'drop') track[track.length - 1].impact = b.sfx[0]?.frame ?? end - 6;
  }
  return track;
}
