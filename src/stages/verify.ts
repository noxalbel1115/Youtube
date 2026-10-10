import fs from 'node:fs';
import path from 'node:path';
import {Script, Timeline, MediaRegistry, Product, VoiceManifest} from '../schemas.js';
import {readJson, sha256File, writeJsonAtomic} from '../core/state.js';
import {PYTHON_BIN, ROOT, rel} from '../core/paths.js';
import {run, ffprobeJson} from '../core/exec.js';
import {wordErrorRate} from '../core/text.js';
import type {Stage} from './types.js';

interface Check {
  id: string;
  ok: boolean;
  severity: 'error' | 'warning';
  detail: string;
}

function parseIntervals(stderr: string, startKey: string, endKey: string): Array<[number, number]> {
  const starts = [...stderr.matchAll(new RegExp(`${startKey}:\\s*([\\d.]+)`, 'g'))].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(new RegExp(`${endKey}:\\s*([\\d.]+)`, 'g'))].map((m) => Number(m[1]));
  return starts.map((s, i) => [s, ends[i] ?? Infinity]);
}

function overlaps(a: [number, number], b: [number, number], tol = 0.15): boolean {
  return a[0] >= b[0] - tol && a[1] <= b[1] + tol;
}

export const verifyStage: Stage = {
  name: 'verify',
  inputHash(ctx) {
    return sha256File(ctx.p.render) + sha256File(ctx.p.timeline);
  },
  async run(ctx) {
    const checks: Check[] = [];
    const add = (id: string, ok: boolean, detail: string, severity: 'error' | 'warning' = 'error') => checks.push({id, ok, severity, detail});
    const t = Timeline.parse(readJson(ctx.p.timeline));
    const script = Script.parse(readJson(ctx.p.script));
    const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
    const product = Product.parse(readJson(ctx.p.product));
    const voice = VoiceManifest.parse(readJson(ctx.p.voice));
    const fmt = ctx.cfg.format;
    const file = ctx.p.render;

    // 1. Formato e duracao
    const probe = await ffprobeJson(file);
    const v = probe.streams.find((s: any) => s.codec_type === 'video');
    const a = probe.streams.find((s: any) => s.codec_type === 'audio');
    const dur = Number(probe.format.duration);
    add('formato.resolucao', v?.width === fmt.width && v?.height === fmt.height, `${v?.width}x${v?.height}`);
    add('formato.fps', v?.r_frame_rate === `${fmt.fps}/1`, `fps ${v?.r_frame_rate}`);
    add('formato.codecs', v?.codec_name === 'h264' && a?.codec_name === 'aac', `video ${v?.codec_name}, audio ${a?.codec_name ?? 'ausente'}`);
    add('formato.duracao', dur >= fmt.minSeconds && dur <= fmt.maxSeconds, `${dur.toFixed(2)}s (alvo ${fmt.minSeconds}-${fmt.maxSeconds}s)`);
    add('formato.shorts', dur <= 180 && v?.height > v?.width, 'vertical e ate 3 min (classificacao automatica como Short)');

    // 2. Quadros pretos: so podem ocorrer onde o roteiro pediu tela preta
    const bd = await run('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.2:pix_th=0.08', '-an', '-f', 'null', '-'], {allowFail: true});
    const blacks = parseIntervals(bd.stderr, 'black_start', 'black_end');
    const intendedBlack: Array<[number, number]> = t.beats
      .filter((b) => b.visual.type === 'black')
      .map((b) => [b.startFrame / t.fps, (b.startFrame + b.durationFrames) / t.fps]);
    const unexpectedBlack = blacks.filter((x) => !intendedBlack.some((i) => overlaps(x, i)));
    add('video.quadros-pretos', unexpectedBlack.length === 0, unexpectedBlack.length ? `inesperados: ${JSON.stringify(unexpectedBlack)}` : `${blacks.length} trecho(s) preto(s), todos intencionais`);

    // 3. Loudness e pico
    const lr = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {allowFail: true});
    const I = Number(lr.stderr.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
    const peak = Number(lr.stderr.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
    add('audio.loudness', Math.abs(I - fmt.loudnessTargetLufs) <= 1.5, `${I} LUFS integrados (alvo ${fmt.loudnessTargetLufs})`);
    add('audio.pico', peak <= fmt.truePeakDb + 0.5, `true peak ${peak} dBFS (limite ${fmt.truePeakDb})`);

    // 4. Silencios: longos so onde ha pausa intencional
    const sd = await run('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=n=-45dB:d=1.2', '-f', 'null', '-'], {allowFail: true});
    const silences = parseIntervals(sd.stderr, 'silence_start', 'silence_end');
    const intendedPauses: Array<[number, number]> = [];
    for (const b of t.beats) {
      const start = b.startFrame / t.fps;
      const end = (b.startFrame + b.durationFrames) / t.fps;
      if (!b.audio) intendedPauses.push([start, end]);
      else {
        intendedPauses.push([start, b.audio.startFrame / t.fps]);
        intendedPauses.push([(b.audio.startFrame + b.audio.durationFrames) / t.fps, end]);
      }
    }
    // Junta pausas adjacentes (fim de um beat + inicio do proximo)
    intendedPauses.sort((x, y) => x[0] - y[0]);
    const merged: Array<[number, number]> = [];
    for (const p of intendedPauses) {
      const last = merged[merged.length - 1];
      if (last && p[0] <= last[1] + 0.05) last[1] = Math.max(last[1], p[1]);
      else merged.push([...p]);
    }
    const unexpectedSilence = silences.filter((s) => !merged.some((m) => overlaps(s, m, 0.3)));
    add('audio.silencios', unexpectedSilence.length === 0, `${silences.length} silencio(s) > 1,2 s abaixo de -45 dB; inesperados: ${JSON.stringify(unexpectedSilence)}`, 'warning');

    // 5. Arquivos referenciados existem
    const refs = [
      ...t.beats.flatMap((b) => [b.mediaFile, b.audio?.file, ...b.sfx.map((s) => s.file)]),
      t.roomToneFile,
    ].filter((x): x is string => !!x);
    const missing = refs.filter((r) => !fs.existsSync(path.join(ctx.p.assets, r)));
    add('arquivos.presentes', missing.length === 0, missing.length ? `ausentes: ${missing.join(', ')}` : `${new Set(refs).size} arquivos referenciados presentes`);

    // 6. Midias: todas com base de uso registrada e licenca permitida
    const allowed = new Set(ctx.cfg.providers.media.allowedLicenses);
    const usedIds = script.beats.filter((b) => b.visual.type === 'media').map((b) => b.visual.mediaId!);
    const bad = usedIds.filter((id) => {
      const it = registry.items.find((i) => i.id === id);
      return !it || it.status !== 'usable' || !allowed.has(it.license) || it.basis === 'none' || !it.verification.ok;
    });
    add('midia.licencas', bad.length === 0, bad.length ? `sem base de uso: ${bad.join(', ')}` : `${new Set(usedIds).size} midia(s), todas com licenca verificada na origem`);
    const bySa = registry.items.filter((i) => usedIds.includes(i.id) && i.license === 'by-sa');
    add('midia.compartilha-igual', bySa.length === 0, bySa.length ? `${bySa.length} midia(s) CC BY-SA: revisar implicacao de licenciamento do video antes de publicar` : 'nenhuma midia BY-SA', 'warning');

    // 7. Falas factuais ancoradas em fatos com fonte
    const facts = new Map(product.facts.map((f) => [f.id, f]));
    const srcIds = new Set(product.sources.map((s) => s.id));
    const factBeats = script.beats.filter((b) => b.claim === 'fact');
    const unanchored = factBeats.filter((b) => b.factIds.length === 0 || b.factIds.some((f) => !facts.has(f) || facts.get(f)!.sourceIds.some((s) => !srcIds.has(s))));
    add('fatos.ancorados', unanchored.length === 0, `${factBeats.length} fala(s) factuais; sem ancora: ${unanchored.map((b) => b.id).join(', ') || 'nenhuma'}`);

    // 8. Pronuncia: transcricao da mixagem final vs roteiro
    const wav = path.join(ctx.p.verifyDir, 'final.wav');
    fs.mkdirSync(ctx.p.verifyDir, {recursive: true});
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', wav]);
    const asr = JSON.parse((await run(PYTHON_BIN, [path.join(ROOT, 'python', 'asr.py'), ctx.cfg.providers.asr.model, wav])).stdout).files[0];
    const refText = script.beats.filter((b) => b.text).map((b) => b.caption ?? b.text).join(' ');
    const wer = wordErrorRate(refText, asr.text);
    add('audio.transcricao-final', wer <= 0.15, `WER ${(wer * 100).toFixed(1)}% entre roteiro e transcricao automatica da mixagem final`);
    const lineIssues = voice.lines.filter((l) => wordErrorRate(script.beats.find((b) => b.id === l.beatId)!.caption ?? l.spokenText, l.asrText) > 0.25);
    add('audio.transcricao-por-fala', lineIssues.length === 0, lineIssues.length ? lineIssues.map((l) => `${l.beatId}: "${l.asrText}"`).join(' | ') : 'todas as falas transcritas com WER <= 25%', 'warning');

    // 9. Legendas: duracao minima de leitura e tamanho
    const fastCaps = t.captions.filter((c) => (c.endFrame - c.startFrame) / t.fps < 0.5);
    const longCaps = t.captions.filter((c) => c.text.length > 30);
    add('legendas.leitura', fastCaps.length === 0, fastCaps.length ? `blocos com menos de 0,5 s: ${fastCaps.map((c) => c.text).join(' | ')}` : `${t.captions.length} blocos, todos com >= 0,5 s`, 'warning');
    add('legendas.tamanho', longCaps.length === 0, longCaps.length ? `blocos com mais de 30 caracteres: ${longCaps.map((c) => c.text).join(' | ')}` : 'todos os blocos com ate 30 caracteres (max. 2 linhas)', 'warning');

    // 10. Quadros para inspecao visual (meio de cada beat + 1 quadro apos cada corte) e folha de contato
    const framesDir = path.join(ctx.p.verifyDir, 'frames');
    fs.rmSync(framesDir, {recursive: true, force: true});
    fs.mkdirSync(framesDir, {recursive: true});
    for (const b of t.beats) {
      const mid = (b.startFrame + b.durationFrames / 2) / t.fps;
      await run('ffmpeg', ['-y', '-v', 'error', '-ss', mid.toFixed(3), '-i', file, '-frames:v', '1', '-vf', 'scale=540:-2', path.join(framesDir, `${b.id}.jpg`)]);
    }
    await run('ffmpeg', ['-y', '-v', 'error', '-pattern_type', 'glob', '-i', path.join(framesDir, '*.jpg'), '-vf', 'scale=270:-2,tile=6x4:padding=6:color=white', '-frames:v', '1', path.join(ctx.p.verifyDir, 'contact-sheet.jpg')]);
    // Forma de onda para revisar ritmo e pausas
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-filter_complex', 'showwavespic=s=1800x300:split_channels=0:colors=#1C2333', '-frames:v', '1', path.join(ctx.p.verifyDir, 'waveform.png')]);

    const errors = checks.filter((c) => !c.ok && c.severity === 'error');
    const prev = fs.existsSync(ctx.p.verifyReport) ? readJson<any>(ctx.p.verifyReport) : null;
    const report = {
      verifiedAt: new Date().toISOString(),
      file: rel(file),
      sha256: sha256File(file),
      durationSeconds: dur,
      automatic: checks,
      finalTranscript: asr.text,
      // A avaliacao audiovisual humana/assistida e registrada separadamente e preservada entre execucoes,
      // mas so vale para o mesmo arquivo (sha256).
      manualReview: prev?.manualReview?.sha256 === sha256File(file) ? prev.manualReview : {status: 'pendente', sha256: sha256File(file), notes: []},
    };
    writeJsonAtomic(ctx.p.verifyReport, report);
    if (errors.length) throw new Error(`Verificacao automatica reprovou: ${errors.map((e) => `${e.id} (${e.detail})`).join('; ')}`);
    const warns = checks.filter((c) => !c.ok && c.severity === 'warning');
    return {outputs: [rel(ctx.p.verifyReport), rel(path.join(ctx.p.verifyDir, 'contact-sheet.jpg'))], note: `${checks.length - errors.length - warns.length}/${checks.length} ok, ${warns.length} aviso(s)`};
  },
};
