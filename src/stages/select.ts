import fs from 'node:fs';
import path from 'node:path';
import {CandidatesFile, Product, Selection, type Candidate} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic} from '../core/state.js';
import {DATA_DIR, rel} from '../core/paths.js';
import type {Config} from '../core/config.js';
import type {Stage} from './types.js';

export interface HistoryEntry {
  episodeId: string;
  productSlug: string;
  productName: string;
  date: string;
}

const HISTORY = path.join(DATA_DIR, 'history.json');

export function loadHistory(): HistoryEntry[] {
  return fs.existsSync(HISTORY) ? readJson<HistoryEntry[]>(HISTORY) : [];
}

export function appendHistory(e: HistoryEntry): void {
  const h = loadHistory().filter((x) => x.episodeId !== e.episodeId);
  h.push(e);
  writeJsonAtomic(HISTORY, h);
}

/** Pontuacao ponderada + regras de elegibilidade. Regras sao eliminatorias; notas so ordenam. */
export function scoreCandidate(c: Candidate, cfg: Config, history: HistoryEntry[], episodeId: string) {
  const w = cfg.selection.weights;
  const allowed = new Set(cfg.providers.media.allowedLicenses);
  const reasons: string[] = [];
  const usableMedia = c.media.filter((m) => allowed.has(m.license));
  const exactMedia = usableMedia.filter((m) => m.showsExactProduct);
  const strongSources = c.sources.filter((s) => ['manufacturer', 'official-store', 'retailer'].includes(s.kind));
  const repeated = history.some((h) => h.productSlug === c.slug && h.episodeId !== episodeId);

  let eligible = true;
  if (exactMedia.length === 0) {
    eligible = false;
    reasons.push('sem midia licenciada mostrando o produto');
  }
  if (c.sources.length < 2) {
    eligible = false;
    reasons.push('menos de 2 fontes');
  }
  if (strongSources.length === 0) {
    eligible = false;
    reasons.push('nenhuma fonte de fabricante/loja');
  }
  if (repeated) {
    eligible = false;
    reasons.push('produto ja usado em episodio anterior');
  }
  const novelty = repeated ? 1 : 5;
  const s = c.scores;
  const score =
    (w.contrast ?? 0) * s.contrast +
    (w.story ?? 0) * s.story +
    (w.visual ?? 0) * s.visual +
    (w.media ?? 0) * s.media +
    (w.reliability ?? 0) * s.reliability +
    (w.novelty ?? 0) * novelty;
  if (eligible) reasons.push(`${exactMedia.length} midia(s) do produto com licenca permitida; ${strongSources.length} fonte(s) de fabricante/loja`);
  return {slug: c.slug, score: Math.round(score * 100) / 100, eligible, reasons};
}

export const selectStage: Stage = {
  name: 'select',
  inputHash(ctx) {
    const pick = ctx.flags.pick ? {slug: ctx.flags.pick, reason: ctx.flags.pickReason ?? ''} : ctx.state.pick;
    return sha256(fs.readFileSync(ctx.p.candidates) + JSON.stringify(pick ?? null) + JSON.stringify(ctx.cfg.selection));
  },
  async run(ctx) {
    if (ctx.flags.pick) {
      if (!ctx.flags.pickReason) throw new Error('--pick exige --reason "..." (a justificativa fica registrada em selection.json)');
      ctx.state.pick = {slug: ctx.flags.pick, reason: ctx.flags.pickReason};
    }
    const pick = ctx.state.pick;
    const file = CandidatesFile.parse(readJson(ctx.p.candidates));
    const history = loadHistory();
    const ranking = file.candidates.map((c) => scoreCandidate(c, ctx.cfg, history, ctx.id)).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
    let chosen = ranking.find((r) => r.eligible);
    if (pick) {
      chosen = ranking.find((r) => r.slug === pick.slug);
      if (!chosen) throw new Error(`--pick ${pick.slug}: candidato inexistente`);
      if (!chosen.eligible) throw new Error(`--pick ${pick.slug}: candidato inelegivel (${chosen.reasons.join('; ')})`);
    }
    if (!chosen) throw new Error('Nenhum candidato elegivel. Amplie a pesquisa (midia licenciada e fontes sao obrigatorias).');
    const cand = file.candidates.find((c) => c.slug === chosen!.slug)!;
    const selection: Selection = {
      selectedAt: new Date().toISOString(),
      slug: cand.slug,
      ranking,
      rationale: pick
        ? `Escolha editorial (--pick), substituindo o 1o colocado automatico (${ranking.find((r) => r.eligible)?.slug}): ${pick.reason} | Angulo: ${cand.comedyAngle}`
        : `Maior pontuacao entre elegiveis. ${cand.comedyAngle}`,
    };
    writeJsonAtomic(ctx.p.selection, Selection.parse(selection));
    const {media: _m, scores: _s, ...rest} = cand;
    const product = Product.parse({...rest, verifiedAt: file.researchedAt});
    writeJsonAtomic(ctx.p.product, product);
    ctx.state.productSlug = cand.slug;
    return {outputs: [rel(ctx.p.selection), rel(ctx.p.product)], note: `selecionado: ${cand.name} (${chosen.score})`};
  },
};
