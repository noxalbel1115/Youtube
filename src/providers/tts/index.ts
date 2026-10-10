import fs from 'node:fs';
import path from 'node:path';
import {run} from '../../core/exec.js';
import {PYTHON_BIN, ROOT} from '../../core/paths.js';
import type {Config} from '../../core/config.js';

export interface TtsItem {
  id: string;
  text: string;
  voice: string;
  speed: number;
  out: string;
}

export interface TtsResult {
  id: string;
  out: string;
  seconds: number;
}

export interface TtsProvider {
  name: string;
  /** Provedores pagos exigem orcamento autorizado (budget.maxUsdPerEpisode > 0). */
  paid: boolean;
  license: string;
  synthesize(items: TtsItem[], cfg: Config): Promise<TtsResult[]>;
}

const kokoro: TtsProvider = {
  name: 'kokoro',
  paid: false,
  license: 'Kokoro-82M: Apache-2.0 (pesos). Execucao local, sem custo por uso.',
  async synthesize(items, cfg) {
    const k = cfg.providers.tts.kokoro;
    const req = {
      model: path.resolve(ROOT, k.model),
      voicesDir: path.resolve(ROOT, k.voicesDir),
      lang: k.lang,
      items,
    };
    if (!fs.existsSync(req.model)) throw new Error(`Modelo Kokoro ausente em ${k.model}. Rode ./scripts/setup.sh`);
    const r = await run(PYTHON_BIN, [path.join(ROOT, 'python', 'tts_kokoro.py')], {input: JSON.stringify(req)});
    return JSON.parse(r.stdout).items;
  },
};

const piper: TtsProvider = {
  name: 'piper',
  paid: false,
  license:
    'ATENCAO: as vozes pt_BR do Piper (cadu, faber, jeff) sao ajustadas a partir da voz "lessac", treinada em dataset de licenca so-pesquisa. Use apenas para testes internos.',
  async synthesize(items, cfg) {
    const out: TtsResult[] = [];
    for (const it of items) {
      const model = path.resolve(ROOT, cfg.providers.tts.piper.voicesDir, `${it.voice}.onnx`);
      await run(PYTHON_BIN, ['-m', 'piper', '-m', model, '-f', it.out, '--length-scale', String(1 / it.speed)], {input: it.text});
      out.push({id: it.id, out: it.out, seconds: await durationOf(it.out)});
    }
    return out;
  },
};

const elevenlabs: TtsProvider = {
  name: 'elevenlabs',
  paid: true,
  license: 'Servico pago; termos comerciais dependem do plano contratado.',
  async synthesize(items, cfg) {
    // Sem a variavel, a chave pode vir de um "network secret" do ambiente em nuvem: o proxy anexa o cabecalho
    // xi-api-key fora da VM, e a chave nunca fica visivel aqui.
    const key = process.env.ELEVENLABS_API_KEY;
    const out: TtsResult[] = [];
    for (const it of items) {
      // it.voice = voice_id da ElevenLabs. Saida PCM 24 kHz convertida para WAV via ffmpeg.
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(it.voice)}?output_format=pcm_24000`, {
        method: 'POST',
        headers: {...(key ? {'xi-api-key': key} : {}), 'content-type': 'application/json'},
        body: JSON.stringify({text: it.text, model_id: cfg.providers.tts.elevenlabs.modelId, voice_settings: {speed: it.speed}}),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`ElevenLabs HTTP ${res.status}: chave ausente ou recusada. Configure ELEVENLABS_API_KEY ou um network secret para api.elevenlabs.io (cabecalho xi-api-key).`);
      }
      if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const pcm = Buffer.from(await res.arrayBuffer());
      const raw = `${it.out}.pcm`;
      fs.writeFileSync(raw, pcm);
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', raw, it.out]);
      fs.unlinkSync(raw);
      out.push({id: it.id, out: it.out, seconds: await durationOf(it.out)});
    }
    return out;
  },
};

export const TTS_PROVIDERS: Record<string, TtsProvider> = {kokoro, piper, elevenlabs};

export async function durationOf(file: string): Promise<number> {
  const r = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(r.stdout.trim());
}
