/**
 * Amostras de voz para comparacao (A/B) fora do pipeline: sintetiza falas com um provedor/voz/modelo, normaliza
 * como a etapa voice (-18 LUFS), transcreve com o Whisper para medir WER e junta tudo num MP3 para ouvir.
 *
 * Uso: npx tsx scripts/voice-ab.ts --provider elevenlabs --voice <id> --label paulo-v4 --model eleven_v4 \
 *        [--speed 1.05] [--lines falas.txt] [--out dir] [--confirm-paid]
 * Provedores pagos exigem --confirm-paid (consome creditos do plano contratado).
 */
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadConfig, loadDotEnv} from '../src/core/config.js';
import {PYTHON_BIN, ROOT} from '../src/core/paths.js';
import {run} from '../src/core/exec.js';
import {wordErrorRate} from '../src/core/text.js';
import {TTS_PROVIDERS, durationOf} from '../src/providers/tts/index.js';

const PILOT_LINES = [
  'Bom dia. Trago uma solução alemã para um problema que o brasileiro ignora há gerações.',
  'O topo do ovo.',
  'A Sueli usa colher.',
  'Ou com o auxílio de talheres adicionais.',
];

const {values: a} = parseArgs({
  options: {
    provider: {type: 'string', default: 'elevenlabs'},
    voice: {type: 'string'},
    label: {type: 'string'},
    model: {type: 'string'},
    speed: {type: 'string', default: '1'},
    lines: {type: 'string'},
    out: {type: 'string', default: 'build/voice-ab'},
    'confirm-paid': {type: 'boolean', default: false},
  },
});

loadDotEnv();
const cfg = loadConfig();
const provider = TTS_PROVIDERS[a.provider!];
if (!provider) throw new Error(`Provedor desconhecido: ${a.provider}`);
if (!a.voice || !a.label) throw new Error('Informe --voice e --label.');
if (provider.paid && !a['confirm-paid']) throw new Error(`${a.provider} e pago: repita com --confirm-paid se o teste foi autorizado.`);
if (a.model && a.provider === 'elevenlabs') cfg.providers.tts.elevenlabs.modelId = a.model;

const lines = a.lines ? fs.readFileSync(a.lines, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : PILOT_LINES;
const dir = path.resolve(ROOT, a.out!, a.label);
fs.mkdirSync(dir, {recursive: true});
const items = lines.map((text, i) => ({id: String(i), text, voice: a.voice!, speed: Number(a.speed), out: path.join(dir, `raw-${i}.wav`)}));

const t0 = Date.now();
await provider.synthesize(items, cfg);
const synthSeconds = (Date.now() - t0) / 1000;

const finals: string[] = [];
for (const it of items) {
  const f = path.join(dir, `fala-${it.id}.wav`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', it.out, '-af', 'loudnorm=I=-18:TP=-3:LRA=11', '-ar', '48000', '-ac', '1', f]);
  finals.push(f);
}
const asr = JSON.parse((await run(PYTHON_BIN, [path.join(ROOT, 'python', 'asr.py'), cfg.providers.asr.model, ...finals])).stdout).files as Array<{text: string}>;

// Junta as falas com 0,6 s de silencio entre elas num MP3 para audicao.
const gap = path.join(dir, 'gap.wav');
await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.6', gap]);
const list = path.join(dir, 'list.txt');
fs.writeFileSync(list, finals.flatMap((f) => [`file '${f}'`, `file '${gap}'`]).join('\n'));
const mp3 = path.join(path.dirname(dir), `${a.label}.mp3`);
await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '160k', mp3]);

const rows = [];
for (const [i, it] of items.entries()) {
  rows.push({fala: it.text, segundos: Number((await durationOf(finals[i])).toFixed(2)), transcricao: asr[i].text, wer: Number(wordErrorRate(it.text, asr[i].text).toFixed(2))});
}
const report = {label: a.label, provider: a.provider, model: a.model ?? null, voice: a.voice, speed: Number(a.speed), caracteres: lines.join('').length, sinteseSegundos: synthSeconds, mp3: path.relative(ROOT, mp3), falas: rows};
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
