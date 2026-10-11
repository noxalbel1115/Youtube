import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {EpisodeState, STAGES, type StageName, type CostEntry} from '../schemas.js';
import {epPaths} from './paths.js';
import {redact} from './log.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Escrita atomica: grava em arquivo temporario e renomeia. Evita JSON truncado se o processo cair. */
export function writeJsonAtomic(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function newState(episodeId: string, locale: EpisodeState['locale'] = 'pt-BR'): EpisodeState {
  const stages: EpisodeState['stages'] = {};
  for (const s of STAGES) stages[s] = {status: 'pending', attempts: 0, outputs: []};
  return {
    schemaVersion: 1,
    episodeId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    currentStage: 'research',
    locale,
    stages,
    artifacts: {},
    costs: [],
    errors: [],
    youtube: {status: 'not_started'},
  };
}

export function loadState(episodeId: string): EpisodeState {
  const file = epPaths(episodeId).state;
  if (!fs.existsSync(file)) throw new Error(`Episodio ${episodeId} nao existe (rode: npm run dnn -- new ${episodeId})`);
  return EpisodeState.parse(readJson(file));
}

export function saveState(state: EpisodeState): void {
  state.updatedAt = nowIso();
  writeJsonAtomic(epPaths(state.episodeId).state, state);
}

export function addCost(state: EpisodeState, entry: Omit<CostEntry, 'at'>): void {
  // Substitui entrada igual (mesma etapa+item) para nao duplicar custos em reexecucoes.
  state.costs = state.costs.filter((c) => !(c.stage === entry.stage && c.item === entry.item));
  state.costs.push({...entry, at: nowIso()});
}

export function recordArtifact(state: EpisodeState, key: string, file: string, root: string): void {
  const st = fs.statSync(file);
  state.artifacts[key] = {path: path.relative(root, file), sha256: sha256File(file), bytes: st.size};
}

/** Invalida etapas posteriores quando uma etapa e refeita com entradas diferentes. */
export function invalidateAfter(state: EpisodeState, stage: StageName): void {
  const idx = STAGES.indexOf(stage);
  for (const s of STAGES.slice(idx + 1)) {
    if (s === 'upload') continue; // upload nunca e invalidado automaticamente: exige decisao humana
    const st = state.stages[s];
    if (st && st.status === 'done') {
      st.status = 'pending';
      st.note = `invalidado: ${stage} mudou`;
    }
  }
}

export function recordError(state: EpisodeState, stage: string, err: unknown): string {
  const message = redact(err instanceof Error ? `${err.message}` : String(err)).slice(0, 4000);
  state.errors.push({stage, at: nowIso(), message});
  if (state.errors.length > 50) state.errors = state.errors.slice(-50);
  return message;
}
