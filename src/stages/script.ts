import fs from 'node:fs';
import path from 'node:path';
import {Script, Product, MediaRegistry} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic, addCost} from '../core/state.js';
import {ROOT, rel} from '../core/paths.js';
import {generateJson, PRICE_PER_MTOK} from '../providers/llm/anthropic.js';
import {BlockedError, type Stage, type Ctx} from './types.js';
import {localeFor} from '../core/locale.js';

/** Estimativa de fala em pt-BR para o Kokoro na velocidade configurada: ~14,5 caracteres/s. */
const CHARS_PER_SECOND = 14.5;

export function estimateSeconds(s: Script): number {
  return s.beats.reduce((acc, b) => acc + b.holdBefore + b.holdAfter + (b.text ? b.text.length / CHARS_PER_SECOND : b.duration ?? 0), 0);
}

/** Validacoes editoriais e de integridade. Erros bloqueiam; avisos sao registrados. */
export function validateScript(ctx: Ctx, s: Script): {errors: string[]; warnings: string[]} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const product = Product.parse(readJson(ctx.p.product));
  const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
  const facts = new Map(product.facts.map((f) => [f.id, f]));
  const usable = new Set(registry.items.filter((i) => i.status === 'usable').map((i) => i.id));
  const speakers = new Set(Object.keys(localeFor(ctx.cfg, s.language).voices));
  const ids = new Set<string>();

  if (s.episodeId !== ctx.id) errors.push(`episodeId do roteiro (${s.episodeId}) difere do episodio (${ctx.id})`);
  if (s.productSlug !== product.slug) errors.push(`productSlug (${s.productSlug}) difere do produto selecionado (${product.slug})`);
  for (const b of s.beats) {
    if (ids.has(b.id)) errors.push(`beat duplicado: ${b.id}`);
    ids.add(b.id);
    if (b.text && !b.speaker) errors.push(`${b.id}: fala sem personagem`);
    if (b.speaker && !speakers.has(b.speaker)) errors.push(`${b.id}: personagem ${b.speaker} sem voz configurada`);
    if (!b.text && !b.duration) errors.push(`${b.id}: beat sem fala precisa de duration`);
    if (b.claim === 'fact' && b.factIds.length === 0) errors.push(`${b.id}: fala factual sem factIds`);
    for (const f of b.factIds) if (!facts.has(f)) errors.push(`${b.id}: fato inexistente ${f}`);
    if (b.visual.type === 'media') {
      if (!b.visual.mediaId) errors.push(`${b.id}: visual media sem mediaId`);
      else if (!usable.has(b.visual.mediaId)) errors.push(`${b.id}: midia ${b.visual.mediaId} nao esta liberada no registro (sem base de uso)`);
    }
    if (b.text && /\d/.test(b.text) && b.claim !== 'fact') warnings.push(`${b.id}: fala com numero classificada como ${b.claim} — confirme que nao e afirmacao factual`);
  }
  const est = estimateSeconds(s);
  if (est < ctx.cfg.format.minSeconds - 5 || est > ctx.cfg.format.maxSeconds + 5) {
    warnings.push(`duracao estimada ${est.toFixed(1)}s fora da faixa ${ctx.cfg.format.minSeconds}-${ctx.cfg.format.maxSeconds}s (a duracao real e medida apos a voz)`);
  }
  if (!s.beats.some((b) => b.factIds.length > 0)) warnings.push('nenhuma fala referencia fatos verificados');
  return {errors, warnings};
}

export const scriptStage: Stage = {
  name: 'script',
  inputHash(ctx) {
    const parts = [ctx.p.script, ctx.p.product, ctx.p.mediaRegistry].map((f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : 'missing'));
    return sha256(parts.join('\n'));
  },
  async run(ctx) {
    if (!fs.existsSync(ctx.p.script)) {
      if (ctx.cfg.providers.llm.script === 'agent') {
        throw new BlockedError(`Aguardando roteiro do agente em ${rel(ctx.p.script)} (formato: src/schemas.ts → Script; guia: prompts/roteiro.md).`);
      }
      const guide = fs.readFileSync(path.join(ROOT, 'prompts', 'roteiro.md'), 'utf8');
      const product = fs.readFileSync(ctx.p.product, 'utf8');
      const media = fs.readFileSync(ctx.p.mediaRegistry, 'utf8');
      const {data, usage} = await generateJson(ctx.cfg, {
        system: 'Voce e roteirista de comedia de falso documentario corporativo. Responda com o JSON do roteiro.',
        prompt: `${guide}\n\nEPISODIO: ${ctx.id}\n\nPRODUTO (fatos verificados):\n${product}\n\nMIDIAS LIBERADAS:\n${media}`,
        schema: Script,
        webSearch: false,
      });
      writeJsonAtomic(ctx.p.script, data);
      const price = PRICE_PER_MTOK[ctx.cfg.providers.llm.anthropic.model];
      if (price) {
        addCost(ctx.state, {
          stage: 'script',
          item: 'anthropic-usd',
          kind: 'estimated',
          amount: (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1e6,
          unit: 'USD',
          basis: 'tokens observados x preco de tabela',
        });
      }
    }
    const script = Script.parse(readJson(ctx.p.script));
    const {errors, warnings} = validateScript(ctx, script);
    if (errors.length) throw new Error(`Roteiro invalido:\n- ${errors.join('\n- ')}`);
    // Versionamento: cada versao validada e arquivada; versao nunca pode regredir.
    fs.mkdirSync(ctx.p.scriptHistory, {recursive: true});
    const archived = path.join(ctx.p.scriptHistory, `v${script.version}.json`);
    if (fs.existsSync(archived) && fs.readFileSync(archived, 'utf8') !== fs.readFileSync(ctx.p.script, 'utf8')) {
      throw new Error(`script.json mudou mas manteve version=${script.version}. Incremente "version" e registre no changelog.`);
    }
    if ((ctx.state.scriptVersion ?? 0) > script.version) throw new Error(`versao do roteiro regrediu (${ctx.state.scriptVersion} → ${script.version})`);
    fs.copyFileSync(ctx.p.script, archived);
    ctx.state.scriptVersion = script.version;
    const note = `roteiro v${script.version}, ${script.beats.length} beats, ~${estimateSeconds(script).toFixed(0)}s estimados${warnings.length ? `; avisos: ${warnings.join(' | ')}` : ''}`;
    return {outputs: [rel(ctx.p.script), rel(archived)], note};
  },
};
