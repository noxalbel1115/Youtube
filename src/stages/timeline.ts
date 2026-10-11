import fs from 'node:fs';
import path from 'node:path';
import {Script, VoiceManifest, MediaRegistry, Product, Timeline, type CaptionChunk, type TimelineBeat} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic} from '../core/state.js';
import {rel} from '../core/paths.js';
import {chunkCaption, normalizeWords} from '../core/text.js';
import {ensureSfx} from '../sfx.js';
import {localized, episodeNumber} from '../core/locale.js';
import type {Stage} from './types.js';

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Distribui blocos de legenda no tempo da fala. Se o ASR reconheceu o mesmo numero de palavras
 * que a legenda, usa os tempos reais de cada palavra; senao, distribui proporcionalmente aos caracteres.
 */
export function timeCaptions(
  text: string,
  seconds: number,
  words: Array<{word: string; start: number; end: number}>,
): Array<{text: string; start: number; end: number}> {
  const chunks = chunkCaption(text);
  const capWords = chunks.map((c) => normalizeWords(c).length);
  const totalCapWords = capWords.reduce((a, b) => a + b, 0);
  if (words.length === totalCapWords && totalCapWords > 0) {
    const out: Array<{text: string; start: number; end: number}> = [];
    let k = 0;
    for (const [i, c] of chunks.entries()) {
      const first = words[k];
      const last = words[k + capWords[i] - 1];
      out.push({text: c, start: first.start, end: last.end});
      k += capWords[i];
    }
    // Encosta blocos consecutivos para nao piscar a tela entre eles
    for (let i = 0; i < out.length - 1; i++) out[i].end = Math.max(out[i].end, out[i + 1].start);
    out[0].start = 0;
    out[out.length - 1].end = seconds;
    return out;
  }
  const totalChars = chunks.reduce((a, c) => a + c.length, 0);
  let t = 0;
  return chunks.map((c) => {
    const d = (c.length / totalChars) * seconds;
    const o = {text: c, start: t, end: t + d};
    t += d;
    return o;
  });
}

export const timelineStage: Stage = {
  name: 'timeline',
  inputHash(ctx) {
    return sha256([ctx.p.script, ctx.p.voice, ctx.p.mediaRegistry, ctx.p.product].map((f) => fs.readFileSync(f, 'utf8')).join('\n') + JSON.stringify(ctx.cfg.format) + JSON.stringify(localized(ctx.cfg, ctx.state.locale).channel) + ctx.state.locale);
  },
  async run(ctx) {
    const script = Script.parse(readJson(ctx.p.script));
    const voice = VoiceManifest.parse(readJson(ctx.p.voice));
    if (voice.scriptVersion !== script.version) throw new Error('voice.json foi gerado para outra versao do roteiro; refaca a etapa voice');
    const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
    const product = Product.parse(readJson(ctx.p.product));
    const fps = ctx.cfg.format.fps;
    const sfxDir = path.join(ctx.p.assets, 'sfx');
    const f = (s: number) => Math.round(s * fps);

    const beats: TimelineBeat[] = [];
    const captions: CaptionChunk[] = [];
    const usedMedia = new Set<string>();
    let cursor = 0;
    for (const b of script.beats) {
      const line = voice.lines.find((l) => l.beatId === b.id);
      const speech = line ? f(line.seconds) : 0;
      const before = f(b.holdBefore);
      const after = f(line ? b.holdAfter : 0);
      const dur = Math.max(before + speech + after, b.duration ? f(b.duration) : 0, 1);
      let mediaFile: string | undefined;
      let mediaSize: {w: number; h: number} | undefined;
      if (b.visual.type === 'media' && b.visual.mediaId) {
        const item = registry.items.find((i) => i.id === b.visual.mediaId && i.status === 'usable');
        if (!item?.localFile) throw new Error(`${b.id}: midia ${b.visual.mediaId} sem arquivo local liberado`);
        mediaFile = item.localFile;
        mediaSize = {w: item.width!, h: item.height!};
        usedMedia.add(item.id);
      }
      const sfx = [];
      for (const s of b.sfx) {
        const file = await ensureSfx(s.id, sfxDir);
        const at = s.at >= 0 ? f(s.at) : dur + f(s.at);
        const frame = cursor + Math.max(0, Math.min(dur - 1, at));
        sfx.push({file: path.relative(ctx.p.assets, file), frame, volume: dbToGain(s.gainDb)});
        if (s.caption) captions.push({text: s.caption, startFrame: frame, endFrame: frame + f(0.9), speaker: s.captionSpeaker});
      }
      beats.push({
        id: b.id,
        startFrame: cursor,
        durationFrames: dur,
        visual: b.visual,
        mediaFile,
        mediaSize,
        audio: line ? {file: line.file, startFrame: cursor + before, durationFrames: speech, speaker: line.speaker} : undefined,
        sfx,
        roomTone: b.roomTone,
      });
      if (line && b.showCaptions) {
        for (const c of timeCaptions(b.caption ?? b.text!, line.seconds, line.words)) {
          captions.push({text: c.text, startFrame: cursor + before + f(c.start), endFrame: cursor + before + f(c.end), speaker: line.speaker});
        }
      }
      cursor += dur;
    }
    const roomTone = await ensureSfx('room-tone', sfxDir);
    const credits = registry.items.filter((i) => usedMedia.has(i.id)).map((i) => i.attribution);
    captions.sort((a, b) => a.startFrame - b.startFrame);
    // Legenda de som nao pode sobrepor a fala seguinte.
    for (let i = 0; i < captions.length - 1; i++) captions[i].endFrame = Math.min(captions[i].endFrame, captions[i + 1].startFrame);
    const {channel: ch, strings} = localized(ctx.cfg, ctx.state.locale);
    const num = episodeNumber(ctx.id);
    const timeline = Timeline.parse({
      fps,
      width: ctx.cfg.format.width,
      height: ctx.cfg.format.height,
      durationInFrames: cursor,
      brand: {name: ch.name, motto: ch.motto, salesmanName: ch.salesman.name, salesmanTitle: ch.salesman.title},
      ui: {caseLabel: strings.caseLabel(num), sealText: ch.shortName, sealLabel: strings.sealLabel(num), factsheetLabel: strings.factsheetLabel},
      product: {name: product.name, brand: product.brand},
      beats,
      captions,
      credits,
      roomToneFile: path.relative(ctx.p.assets, roomTone),
    });
    writeJsonAtomic(ctx.p.timeline, timeline);
    return {outputs: [rel(ctx.p.timeline)], note: `${(cursor / fps).toFixed(2)}s, ${beats.length} beats, ${captions.length} blocos de legenda, ${usedMedia.size} midias`};
  },
};
