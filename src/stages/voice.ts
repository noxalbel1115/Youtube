import fs from 'node:fs';
import path from 'node:path';
import {Script, VoiceManifest, type VoiceLine} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic, addCost} from '../core/state.js';
import {PYTHON_BIN, ROOT, rel} from '../core/paths.js';
import {run} from '../core/exec.js';
import {log} from '../core/log.js';
import {applyPronunciations, wordErrorRate} from '../core/text.js';
import {TTS_PROVIDERS, durationOf, type TtsItem} from '../providers/tts/index.js';
import {localized} from '../core/locale.js';
import {BlockedError, type Ctx, type Stage} from './types.js';

/** WER acima disto na transcricao de uma fala indica pronuncia ruim ou palavra engolida. */
export const LINE_WER_LIMIT = 0.25;

/** Ajusta o andamento (quando o provedor nao controla velocidade), remove silencio nas pontas e normaliza (-18 LUFS), 48 kHz mono. */
async function postProcess(input: string, output: string, tempo = 1): Promise<void> {
  const pre = tempo !== 1 ? `atempo=${tempo},` : '';
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse';
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-af', `${pre}${trim},loudnorm=I=-18:TP=-3:LRA=11`, '-ar', '48000', '-ac', '1', output]);
}

/**
 * Registra o consumo de um provedor pago. Creditos informados pela API entram como observados; sem essa informacao,
 * a estimativa usa 1 credito por caractere enviado (multiplicador 1,0 informado por /v1/models para eleven_v3/v4).
 * Ressintese de falas ja pagas soma de novo: cada chamada consome creditos.
 */
function recordPaidUsage(ctx: Ctx, provider: string, items: TtsItem[], results: Array<{credits?: number}>): void {
  const chars = items.reduce((a, it) => a + it.text.length, 0);
  const reported = results.every((r) => typeof r.credits === 'number');
  const amount = reported ? results.reduce((a, r) => a + (r.credits ?? 0), 0) : chars;
  const prev = ctx.state.costs.filter((c) => c.stage === 'voice' && c.item === `${provider}-credits`).reduce((a, c) => a + c.amount, 0);
  addCost(ctx.state, {stage: 'voice', item: `${provider}-credits`, kind: reported ? 'observed' : 'estimated', amount: prev + amount, unit: `${provider}-credits`,
    basis: `${reported ? `creditos informados pela API (cabecalho character-cost) para ${chars} caracteres` : `estimado: ${chars} caracteres x 1 credito`} na ultima sintese (${items.length} fala(s)); valor acumulado do episodio, inclusive ressinteses. Custo em dinheiro depende do plano contratado.`});
}

export const voiceStage: Stage = {
  name: 'voice',
  inputHash(ctx) {
    // Só o que muda o audio: a confirmacao de licenca (commercialLicenseConfirmed) fica de fora para nao refazer o render.
    const {kokoro, piper, elevenlabs} = ctx.cfg.providers.tts;
    const voices = localized(ctx.cfg, ctx.state.locale).voices;
    return sha256(fs.readFileSync(ctx.p.script, 'utf8') + JSON.stringify({voices, kokoro, piper, elevenlabs: {modelId: elevenlabs.modelId}}) + JSON.stringify(ctx.cfg.providers.asr) + ctx.state.locale);
  },
  async run(ctx) {
    const script = Script.parse(readJson(ctx.p.script));
    const {voices, strings} = localized(ctx.cfg, ctx.state.locale);
    fs.mkdirSync(ctx.p.lines, {recursive: true});
    const rawDir = path.join(ctx.p.build, 'tts-raw');
    fs.mkdirSync(rawDir, {recursive: true});

    // Agrupa pedidos por provedor; reaproveita falas ja sintetizadas com a mesma chave (texto+voz+velocidade).
    const byProvider = new Map<string, TtsItem[]>();
    const plan: Array<{beatId: string; speaker: NonNullable<(typeof script.beats)[number]['speaker']>; provider: string; voice: string; spoken: string; raw: string; final: string; tempo: number}> = [];
    for (const b of script.beats) {
      if (!b.text || !b.speaker) continue;
      const v = voices[b.speaker];
      const provider = TTS_PROVIDERS[v.provider];
      if (!provider) throw new Error(`Provedor de voz desconhecido: ${v.provider}`);
      if (provider.paid && ctx.cfg.budget.maxUsdPerEpisode <= 0 && !ctx.state.paidTtsAuthorization) {
        throw new BlockedError(`Voz "${b.speaker}" usa provedor pago (${v.provider}) sem orcamento (budget.maxUsdPerEpisode = 0) nem autorizacao do episodio (--authorize-paid-tts).`);
      }
      const spoken = applyPronunciations(b.text, {...script.pronunciations, ...(script.providerPronunciations[v.provider] ?? {})});
      const speed = Math.round(v.speed * b.speedFactor * 1000) / 1000;
      // Chave do audio bruto: so o que o provedor recebe. Chave final: inclui a velocidade aplicada localmente.
      const tag = provider.cacheTag?.(ctx.cfg) ?? '';
      const synthSpeed = provider.nativeSpeed ? speed : 1;
      const rawKey = sha256(`${v.provider}|${tag}|${v.voice}|${synthSpeed}|${spoken}`).slice(0, 12);
      const finalKey = sha256(`${v.provider}|${tag}|${v.voice}|${speed}|${spoken}`).slice(0, 12);
      const raw = path.join(rawDir, `${b.id}-${rawKey}.wav`);
      const final = path.join(ctx.p.lines, `${b.id}-${finalKey}.wav`);
      plan.push({beatId: b.id, speaker: b.speaker, provider: v.provider, voice: v.voice, spoken, raw, final, tempo: provider.nativeSpeed ? 1 : speed});
      if (!fs.existsSync(final) && !fs.existsSync(raw)) {
        const list = byProvider.get(v.provider) ?? [];
        list.push({id: b.id, text: spoken, voice: v.voice, speed: synthSpeed, out: raw});
        byProvider.set(v.provider, list);
      }
    }
    const t0 = Date.now();
    let synthesized = 0;
    for (const [name, items] of byProvider) {
      log.info(`sintetizando ${items.length} fala(s) com ${name}`);
      const results = await TTS_PROVIDERS[name].synthesize(items, ctx.cfg);
      synthesized += items.length;
      if (TTS_PROVIDERS[name].paid) recordPaidUsage(ctx, name, items, results);
    }
    for (const p of plan) if (!fs.existsSync(p.final)) await postProcess(p.raw, p.final, p.tempo);
    if (synthesized > 0) {
      ctx.state.costs = ctx.state.costs.filter((c) => !(c.stage === 'voice' && c.item === 'tts-cpu'));
      addCost(ctx.state, {stage: 'voice', item: 'tts-tempo', kind: 'observed', amount: Math.round((Date.now() - t0) / 100) / 10, unit: 'seconds', basis: `${synthesized} fala(s) sintetizadas na ultima sintese (${[...byProvider.keys()].join(', ')})`});
    }

    // Transcricao de volta (ASR) para conferir pronuncia e obter tempos de palavra para as legendas.
    // Cache por arquivo: o nome ja carrega o hash de texto+voz+velocidade, entao so falas novas sao transcritas.
    type Asr = {file: string; text: string; words: Array<{word: string; start: number; end: number}>};
    const cacheFile = path.join(ctx.p.build, 'asr-cache.json');
    const cacheKey = (f: string) => `${ctx.cfg.providers.asr.model}:${path.basename(f)}`;
    const cache: Record<string, Asr> = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
    const missing = plan.map((p) => p.final).filter((f) => !cache[cacheKey(f)]);
    if (missing.length) {
      const asr = await run(PYTHON_BIN, [path.join(ROOT, 'python', 'asr.py'), ctx.cfg.providers.asr.model, `--lang=${strings.asrLanguage}`, ...missing]);
      for (const r of JSON.parse(asr.stdout).files as Asr[]) cache[cacheKey(r.file)] = r;
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    const files: Asr[] = plan.map((p) => cache[cacheKey(p.final)]);

    const lines: VoiceLine[] = [];
    const flagged: string[] = [];
    for (const [i, p] of plan.entries()) {
      const tr = files[i];
      const beat = script.beats.find((b) => b.id === p.beatId)!;
      const wer = wordErrorRate(beat.caption ?? beat.text!, tr.text, ctx.state.locale);
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
    // Mantem generatedAt quando nada mudou, para nao invalidar timeline e render a toa.
    const prev = fs.existsSync(ctx.p.voice) ? VoiceManifest.safeParse(readJson(ctx.p.voice)) : null;
    const same = prev?.success && prev.data.scriptVersion === script.version && JSON.stringify(prev.data.lines) === JSON.stringify(VoiceManifest.parse({scriptVersion: script.version, generatedAt: '', lines}).lines);
    writeJsonAtomic(ctx.p.voice, VoiceManifest.parse({scriptVersion: script.version, generatedAt: same ? prev.data.generatedAt : new Date().toISOString(), lines}));
    const total = lines.reduce((a, l) => a + l.seconds, 0);
    if (flagged.length) log.warn(`Falas com transcricao divergente (revisar pronuncia): ${flagged.join('; ')}`);
    return {outputs: [rel(ctx.p.voice)], note: `${lines.length} falas, ${total.toFixed(1)}s de fala; ${flagged.length} com divergencia de transcricao`};
  },
};
