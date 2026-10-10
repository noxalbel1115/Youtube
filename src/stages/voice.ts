import fs from 'node:fs';
import path from 'node:path';
import {Script, VoiceManifest, type VoiceLine} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic, addCost} from '../core/state.js';
import {PYTHON_BIN, ROOT, rel} from '../core/paths.js';
import {run} from '../core/exec.js';
import {log} from '../core/log.js';
import {applyPronunciations, wordErrorRate} from '../core/text.js';
import {TTS_PROVIDERS, durationOf, type TtsItem} from '../providers/tts/index.js';
import {BlockedError, type Stage} from './types.js';

/** WER acima disto na transcricao de uma fala indica pronuncia ruim ou palavra engolida. */
export const LINE_WER_LIMIT = 0.25;

/** Remove silencio nas pontas e normaliza o nivel de cada fala (-18 LUFS), 48 kHz mono. */
async function postProcess(input: string, output: string): Promise<void> {
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse';
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-af', `${trim},loudnorm=I=-18:TP=-3:LRA=11`, '-ar', '48000', '-ac', '1', output]);
}

export const voiceStage: Stage = {
  name: 'voice',
  inputHash(ctx) {
    return sha256(fs.readFileSync(ctx.p.script, 'utf8') + JSON.stringify(ctx.cfg.providers.tts) + JSON.stringify(ctx.cfg.providers.asr));
  },
  async run(ctx) {
    const script = Script.parse(readJson(ctx.p.script));
    const voices = ctx.cfg.providers.tts.voices;
    fs.mkdirSync(ctx.p.lines, {recursive: true});
    const rawDir = path.join(ctx.p.build, 'tts-raw');
    fs.mkdirSync(rawDir, {recursive: true});

    // Agrupa pedidos por provedor; reaproveita falas ja sintetizadas com a mesma chave (texto+voz+velocidade).
    const byProvider = new Map<string, TtsItem[]>();
    const plan: Array<{beatId: string; speaker: NonNullable<(typeof script.beats)[number]['speaker']>; provider: string; voice: string; spoken: string; raw: string; final: string}> = [];
    for (const b of script.beats) {
      if (!b.text || !b.speaker) continue;
      const v = voices[b.speaker];
      const provider = TTS_PROVIDERS[v.provider];
      if (!provider) throw new Error(`Provedor de voz desconhecido: ${v.provider}`);
      if (provider.paid && ctx.cfg.budget.maxUsdPerEpisode <= 0) {
        throw new BlockedError(`Voz "${b.speaker}" usa provedor pago (${v.provider}) sem orcamento autorizado (budget.maxUsdPerEpisode = 0).`);
      }
      const spoken = applyPronunciations(b.text, script.pronunciations);
      const key = sha256(`${v.provider}|${v.voice}|${v.speed}|${spoken}`).slice(0, 12);
      const raw = path.join(rawDir, `${b.id}-${key}.wav`);
      const final = path.join(ctx.p.lines, `${b.id}-${key}.wav`);
      plan.push({beatId: b.id, speaker: b.speaker, provider: v.provider, voice: v.voice, spoken, raw, final});
      if (!fs.existsSync(final)) {
        const list = byProvider.get(v.provider) ?? [];
        list.push({id: b.id, text: spoken, voice: v.voice, speed: v.speed, out: raw});
        byProvider.set(v.provider, list);
      }
    }
    const t0 = Date.now();
    let synthesized = 0;
    for (const [name, items] of byProvider) {
      log.info(`sintetizando ${items.length} fala(s) com ${name}`);
      await TTS_PROVIDERS[name].synthesize(items, ctx.cfg);
      synthesized += items.length;
    }
    for (const p of plan) if (!fs.existsSync(p.final)) await postProcess(p.raw, p.final);
    if (synthesized > 0) {
      addCost(ctx.state, {stage: 'voice', item: 'tts-cpu', kind: 'observed', amount: Math.round((Date.now() - t0) / 100) / 10, unit: 'seconds', basis: `${synthesized} fala(s) sintetizadas localmente na ultima sintese (sem cobranca por uso)`});
    }

    // Transcricao de volta (ASR) para conferir pronuncia e obter tempos de palavra para as legendas.
    // Cache por arquivo: o nome ja carrega o hash de texto+voz+velocidade, entao so falas novas sao transcritas.
    type Asr = {file: string; text: string; words: Array<{word: string; start: number; end: number}>};
    const cacheFile = path.join(ctx.p.build, 'asr-cache.json');
    const cacheKey = (f: string) => `${ctx.cfg.providers.asr.model}:${path.basename(f)}`;
    const cache: Record<string, Asr> = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
    const missing = plan.map((p) => p.final).filter((f) => !cache[cacheKey(f)]);
    if (missing.length) {
      const asr = await run(PYTHON_BIN, [path.join(ROOT, 'python', 'asr.py'), ctx.cfg.providers.asr.model, ...missing]);
      for (const r of JSON.parse(asr.stdout).files as Asr[]) cache[cacheKey(r.file)] = r;
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    const files: Asr[] = plan.map((p) => cache[cacheKey(p.final)]);

    const lines: VoiceLine[] = [];
    const flagged: string[] = [];
    for (const [i, p] of plan.entries()) {
      const tr = files[i];
      const beat = script.beats.find((b) => b.id === p.beatId)!;
      const wer = wordErrorRate(beat.caption ?? beat.text!, tr.text);
      // Falas de 1-2 palavras: o Whisper alucina em audio curtissimo; ficam cobertas pela transcricao da mixagem final.
      const shortLine = (beat.caption ?? beat.text!).split(/\s+/).length < 3;
      if (wer > LINE_WER_LIMIT && !beat.skipAsrCheck && !shortLine) flagged.push(`${p.beatId} (WER ${(wer * 100).toFixed(0)}%: "${tr.text}")`);
      lines.push({
        beatId: p.beatId,
        speaker: p.speaker,
        provider: p.provider,
        voice: p.voice,
        file: path.relative(ctx.p.assets, p.final),
        seconds: await durationOf(p.final),
        spokenText: p.spoken,
        words: tr.words.map((w) => ({word: w.word, start: w.start, end: w.end})),
        asrText: tr.text,
      });
    }
    writeJsonAtomic(ctx.p.voice, VoiceManifest.parse({scriptVersion: script.version, generatedAt: new Date().toISOString(), lines}));
    const total = lines.reduce((a, l) => a + l.seconds, 0);
    if (flagged.length) log.warn(`Falas com transcricao divergente (revisar pronuncia): ${flagged.join('; ')}`);
    return {outputs: [rel(ctx.p.voice)], note: `${lines.length} falas, ${total.toFixed(1)}s de fala; ${flagged.length} com divergencia de transcricao`};
  },
};
