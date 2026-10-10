import {z} from 'zod';

// ---------------------------------------------------------------------------
// Pesquisa: fontes, fatos e candidatos
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'data ISO (AAAA-MM-DD)');

export const Source = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  kind: z.enum(['manufacturer', 'official-store', 'retailer', 'encyclopedia', 'press', 'patent', 'other']),
  accessedAt: isoDate,
  confirms: z.string().describe('O que esta fonte confirma, em uma frase.'),
});
export type Source = z.infer<typeof Source>;

export const Fact = z.object({
  id: z.string(),
  text: z.string().describe('Fato verificavel sobre o produto, em portugues.'),
  sourceIds: z.array(z.string()).min(1),
});
export type Fact = z.infer<typeof Fact>;

export const Price = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  sourceId: z.string(),
  observedAt: isoDate,
  note: z.string().optional(),
});

export const Scores = z.object({
  contrast: z.number().min(1).max(5),
  story: z.number().min(1).max(5),
  visual: z.number().min(1).max(5),
  media: z.number().min(1).max(5),
  reliability: z.number().min(1).max(5),
});

export const LicenseCode = z.enum(['cc0', 'pdm', 'by', 'by-sa', 'by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'permission', 'own', 'generated', 'unknown']);
export type LicenseCode = z.infer<typeof LicenseCode>;

export const MediaCandidate = z.object({
  id: z.string(),
  kind: z.enum(['image', 'video', 'audio']),
  title: z.string(),
  creator: z.string(),
  provider: z.enum(['wikimedia', 'openverse', 'flickr', 'manufacturer', 'own', 'generated', 'other']),
  landingUrl: z.string().url(),
  fileUrl: z.string().url().optional(),
  license: LicenseCode,
  licenseVersion: z.string().optional(),
  licenseUrl: z.string().url().optional(),
  showsExactProduct: z.boolean(),
  description: z.string(),
  /** Para Openverse: id do registro; para Wikimedia: nome do arquivo "File:...". */
  providerRef: z.string().optional(),
});
export type MediaCandidate = z.infer<typeof MediaCandidate>;

export const Candidate = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  brand: z.string(),
  description: z.string(),
  legitimateUse: z.string(),
  punchingDownRisk: z.string(),
  sources: z.array(Source).min(1),
  facts: z.array(Fact).default([]),
  price: Price.nullable(),
  media: z.array(MediaCandidate).default([]),
  scores: Scores,
  risks: z.array(z.string()).default([]),
  comedyAngle: z.string(),
});
export type Candidate = z.infer<typeof Candidate>;

export const CandidatesFile = z.object({
  researchedAt: isoDate,
  method: z.string(),
  candidates: z.array(Candidate).min(1),
});
export type CandidatesFile = z.infer<typeof CandidatesFile>;

export const Selection = z.object({
  selectedAt: z.string(),
  slug: z.string(),
  ranking: z.array(z.object({slug: z.string(), score: z.number(), eligible: z.boolean(), reasons: z.array(z.string())})),
  rationale: z.string(),
});
export type Selection = z.infer<typeof Selection>;

export const Product = Candidate.omit({media: true, scores: true}).extend({
  verifiedAt: isoDate,
});
export type Product = z.infer<typeof Product>;

// ---------------------------------------------------------------------------
// Registro de midias (com base de uso e condicoes)
// ---------------------------------------------------------------------------

export const MediaItem = MediaCandidate.extend({
  basis: z.enum(['license', 'permission', 'own-work', 'generated', 'none']),
  conditions: z.array(z.string()),
  modifications: z.string(),
  attribution: z.string(),
  localFile: z.string().optional(),
  sha256: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  verification: z.object({
    at: z.string(),
    method: z.string(),
    ok: z.boolean(),
    detail: z.string(),
  }),
  status: z.enum(['usable', 'excluded']),
  excludedReason: z.string().optional(),
});
export type MediaItem = z.infer<typeof MediaItem>;

export const MediaRegistry = z.object({
  updatedAt: z.string(),
  items: z.array(MediaItem),
});
export type MediaRegistry = z.infer<typeof MediaRegistry>;

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------

export const Speaker = z.enum(['vendedor', 'colega', 'locutor']);
export type Speaker = z.infer<typeof Speaker>;

export const Visual = z.object({
  type: z.enum(['media', 'card', 'factsheet', 'title', 'black', 'endcard', 'scene3d']),
  /** type=scene3d: cena 3D propria (ex.: "egg-topper") e a deixa deste beat (hero, place, lift, drop, hold, open, gem...). */
  scene: z.string().optional(),
  cue: z.string().optional(),
  mediaId: z.string().optional(),
  motion: z.enum(['push-in', 'pull-out', 'pan-left', 'pan-right', 'static', 'snap-in', 'drift']).default('static'),
  /** full = foto ocupa o quadro (recorte vertical); exhibit = foto inteira em painel sobre o papel timbrado. */
  layout: z.enum(['full', 'exhibit']).default('full'),
  /** Legenda institucional da foto em layout exhibit (ex.: "Fig. 1 — Modelo de mesa"). */
  label: z.string().optional(),
  /** Ponto focal (0..1) para enquadramento e zoom. */
  focus: z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1)}).default({x: 0.5, y: 0.5}),
  zoom: z.number().min(1).max(3).default(1.15),
  /** Desloca a foto para baixo (px) quando o assunto encosta no topo; o espaco e preenchido com 'bg'. */
  offsetY: z.number().min(0).max(400).default(0),
  /** Cor de preenchimento (amostrada da propria foto) para offsetY. */
  bg: z.string().optional(),
  /** Texto principal de cartela (type=card/title). */
  heading: z.string().optional(),
  body: z.string().optional(),
  /** Rodape institucional da cartela, ex.: "Fonte: ...". */
  footnote: z.string().optional(),
  /** Carimbo institucional (ex.: "EM ANALISE") e o instante, em segundos desde o inicio do beat. */
  stamp: z.string().optional(),
  stampAt: z.number().min(0).default(0.6),
  /** Mostrar a etiqueta do vendedor (lower third) neste beat. */
  lowerThird: z.boolean().default(false),
});
export type Visual = z.infer<typeof Visual>;

export const Sfx = z.object({
  id: z.string(),
  /** segundos a partir do inicio do beat; negativo = a partir do fim */
  at: z.number(),
  gainDb: z.number().default(0),
  /** Legenda de som (acessibilidade e quem assiste sem audio), ex.: "(toc, toc)". */
  caption: z.string().optional(),
  captionSpeaker: z.enum(['vendedor', 'colega', 'locutor']).default('colega'),
});

export const Beat = z.object({
  id: z.string(),
  speaker: Speaker.optional(),
  text: z.string().optional(),
  /** Texto da legenda, se diferente do falado (ex.: grafia de marca). */
  caption: z.string().optional(),
  /** Classificacao editorial da fala. fact = afirma algo sobre o produto real. */
  claim: z.enum(['fact', 'fiction', 'none']).default('none'),
  factIds: z.array(z.string()).default([]),
  /** Silencio antes/depois da fala, em segundos. Pausas sao parte da piada. */
  holdBefore: z.number().min(0).default(0),
  holdAfter: z.number().min(0).default(0.25),
  /** Duracao fixa para beats sem fala. */
  duration: z.number().positive().optional(),
  visual: Visual,
  sfx: z.array(Sfx).default([]),
  /** Pular a conferencia por transcricao (fala com palavra estrangeira que o ASR em pt nao reconhece). */
  skipAsrCheck: z.boolean().default(false),
  /** Legenda da fala. Desligar quando a cartela ja mostra o mesmo texto (ex.: lema no encerramento). */
  showCaptions: z.boolean().default(true),
  /** Ambiente sonoro do escritorio. */
  roomTone: z.boolean().default(true),
  note: z.string().optional(),
});
export type Beat = z.infer<typeof Beat>;

export const Script = z.object({
  version: z.number().int().positive(),
  episodeId: z.string(),
  productSlug: z.string(),
  workingTitle: z.string(),
  logline: z.string(),
  arc: z.array(z.string()).min(3).describe('Progressao dramatica em etapas.'),
  pronunciations: z.record(z.string(), z.string()).default({}),
  beats: z.array(Beat).min(4),
  packaging: z.object({
    title: z.string().max(100),
    synopsis: z.string().describe('1-2 frases para a descricao, sem entregar a piada.'),
    tags: z.array(z.string()).max(15),
    thumbnailBeatId: z.string(),
  }),
  changelog: z.array(z.object({version: z.number(), note: z.string()})).default([]),
});
export type Script = z.infer<typeof Script>;

// ---------------------------------------------------------------------------
// Voz e linha do tempo (props do Remotion)
// ---------------------------------------------------------------------------

export const WordTiming = z.object({word: z.string(), start: z.number(), end: z.number()});
export type WordTiming = z.infer<typeof WordTiming>;

export const VoiceLine = z.object({
  beatId: z.string(),
  speaker: Speaker,
  provider: z.string(),
  voice: z.string(),
  file: z.string(),
  seconds: z.number(),
  spokenText: z.string(),
  words: z.array(WordTiming),
  asrText: z.string(),
});
export type VoiceLine = z.infer<typeof VoiceLine>;

export const VoiceManifest = z.object({
  scriptVersion: z.number(),
  generatedAt: z.string(),
  lines: z.array(VoiceLine),
});
export type VoiceManifest = z.infer<typeof VoiceManifest>;

export const CaptionChunk = z.object({text: z.string(), startFrame: z.number(), endFrame: z.number(), speaker: Speaker});
export type CaptionChunk = z.infer<typeof CaptionChunk>;

export const TimelineBeat = z.object({
  id: z.string(),
  startFrame: z.number(),
  durationFrames: z.number(),
  visual: Visual,
  mediaFile: z.string().optional(),
  mediaSize: z.object({w: z.number(), h: z.number()}).optional(),
  audio: z
    .object({file: z.string(), startFrame: z.number(), durationFrames: z.number(), speaker: Speaker})
    .optional(),
  sfx: z.array(z.object({file: z.string(), frame: z.number(), volume: z.number()})),
  roomTone: z.boolean(),
});
export type TimelineBeat = z.infer<typeof TimelineBeat>;

export const Timeline = z.object({
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  durationInFrames: z.number(),
  brand: z.object({name: z.string(), motto: z.string(), salesmanName: z.string(), salesmanTitle: z.string()}),
  product: z.object({name: z.string(), brand: z.string()}),
  beats: z.array(TimelineBeat),
  captions: z.array(CaptionChunk),
  credits: z.array(z.string()),
  roomToneFile: z.string().optional(),
});
export type Timeline = z.infer<typeof Timeline>;

// ---------------------------------------------------------------------------
// Estado persistente do episodio
// ---------------------------------------------------------------------------

export const STAGES = ['research', 'select', 'media', 'script', 'voice', 'timeline', 'render', 'verify', 'package', 'upload'] as const;
export type StageName = (typeof STAGES)[number];

export const StageState = z.object({
  status: z.enum(['pending', 'running', 'done', 'failed', 'blocked', 'skipped']),
  attempts: z.number().default(0),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  seconds: z.number().optional(),
  inputHash: z.string().optional(),
  outputs: z.array(z.string()).default([]),
  error: z.string().optional(),
  note: z.string().optional(),
});
export type StageState = z.infer<typeof StageState>;

export const CostEntry = z.object({
  stage: z.string(),
  item: z.string(),
  kind: z.enum(['observed', 'estimated']),
  amount: z.number(),
  unit: z.string().describe('USD, BRL, youtube-quota-units, tokens, cpu-seconds...'),
  basis: z.string(),
  at: z.string(),
});
export type CostEntry = z.infer<typeof CostEntry>;

export const YoutubeState = z.object({
  status: z.enum(['not_started', 'session_created', 'uploading', 'uploaded', 'processing', 'processed', 'failed', 'needs_reconcile']),
  idempotencyKey: z.string().optional(),
  uploadSessionUri: z.string().optional(),
  sessionCreatedAt: z.string().optional(),
  videoId: z.string().optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
  publishAt: z.string().optional(),
  uploadedFileSha256: z.string().optional(),
  captions: z.object({status: z.string(), id: z.string().optional()}).optional(),
  thumbnail: z.object({status: z.string()}).optional(),
  lastCheckedAt: z.string().optional(),
  remote: z.record(z.string(), z.unknown()).optional(),
});
export type YoutubeState = z.infer<typeof YoutubeState>;

export const EpisodeState = z.object({
  schemaVersion: z.literal(1),
  episodeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  currentStage: z.string(),
  productSlug: z.string().optional(),
  /** Escolha editorial persistida (--pick/--reason) para que reexecucoes nao revertam a selecao. */
  pick: z.object({slug: z.string(), reason: z.string()}).optional(),
  scriptVersion: z.number().optional(),
  stages: z.record(z.string(), StageState),
  artifacts: z.record(z.string(), z.object({path: z.string(), sha256: z.string().optional(), bytes: z.number().optional()})),
  costs: z.array(CostEntry),
  errors: z.array(z.object({stage: z.string(), at: z.string(), message: z.string()})),
  youtube: YoutubeState,
});
export type EpisodeState = z.infer<typeof EpisodeState>;
