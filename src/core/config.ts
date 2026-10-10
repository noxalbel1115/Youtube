import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './paths.js';

const VoiceCfg = z.object({provider: z.enum(['kokoro', 'piper', 'elevenlabs']), voice: z.string(), speed: z.number().default(1)});

export const Config = z.object({
  channel: z.object({
    name: z.string(),
    shortName: z.string(),
    motto: z.string(),
    language: z.string(),
    salesman: z.object({name: z.string(), title: z.string()}),
  }),
  format: z.object({
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    minSeconds: z.number(),
    maxSeconds: z.number(),
    loudnessTargetLufs: z.number(),
    truePeakDb: z.number(),
  }),
  providers: z.object({
    llm: z.object({
      research: z.enum(['agent', 'anthropic']),
      script: z.enum(['agent', 'anthropic']),
      anthropic: z.object({model: z.string(), maxTokens: z.number()}),
    }),
    tts: z.object({
      voices: z.record(z.string(), VoiceCfg),
      kokoro: z.object({model: z.string(), voicesDir: z.string(), lang: z.string()}),
      piper: z.object({voicesDir: z.string()}),
      elevenlabs: z.object({modelId: z.string(), commercialLicenseConfirmed: z.boolean().default(false)}),
    }),
    asr: z.object({provider: z.literal('faster-whisper'), model: z.string()}),
    media: z.object({allowedLicenses: z.array(z.string())}),
  }),
  selection: z.object({weights: z.record(z.string(), z.number())}),
  youtube: z.object({
    uploadEnabled: z.boolean(),
    defaultPrivacyStatus: z.enum(['private', 'unlisted', 'public']),
    allowPublic: z.boolean(),
    allowScheduledPublish: z.boolean(),
    categoryId: z.string(),
    selfDeclaredMadeForKids: z.boolean(),
    containsSyntheticMedia: z.boolean(),
    uploadCaptions: z.boolean(),
    uploadThumbnail: z.boolean(),
    tokenFile: z.string(),
  }),
  budget: z.object({maxUsdPerEpisode: z.number()}),
});
export type Config = z.infer<typeof Config>;

let cached: Config | null = null;

export function loadConfig(file = process.env.DNN_CONFIG ?? path.join(ROOT, 'config', 'channel.json')): Config {
  if (cached) return cached;
  cached = Config.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  return cached;
}

/** Carrega .env (se existir) sem dependencia externa. Nao sobrescreve variaveis ja definidas. */
export function loadDotEnv(file = path.join(ROOT, '.env')): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = raw.replace(/^["']|["']$/g, '');
  }
}
