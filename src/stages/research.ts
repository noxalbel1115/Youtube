import fs from 'node:fs';
import path from 'node:path';
import {CandidatesFile} from '../schemas.js';
import {readJson, sha256, writeJsonAtomic, addCost} from '../core/state.js';
import {ROOT, rel} from '../core/paths.js';
import {log} from '../core/log.js';
import {generateJson, PRICE_PER_MTOK} from '../providers/llm/anthropic.js';
import {BlockedError, type Stage} from './types.js';
import {loadHistory} from './select.js';

const UA = 'DNN-pipeline/0.1 (+https://github.com/noxalbel1115/Youtube)';

/** Confere se cada URL de fonte responde. Nao prova o conteudo; registra o status HTTP observado. */
async function linkCheck(urls: string[]): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {};
  for (const url of urls) {
    try {
      const res = await fetch(url, {method: 'GET', redirect: 'follow', headers: {'user-agent': UA}, signal: AbortSignal.timeout(20000)});
      out[url] = res.status;
      await res.body?.cancel();
    } catch (e) {
      out[url] = `erro: ${(e as Error).message}`;
    }
  }
  return out;
}

export const researchStage: Stage = {
  name: 'research',
  inputHash(ctx) {
    return fs.existsSync(ctx.p.candidates) ? sha256(fs.readFileSync(ctx.p.candidates)) : 'missing';
  },
  async run(ctx) {
    const mode = ctx.cfg.providers.llm.research;
    if (!fs.existsSync(ctx.p.candidates)) {
      if (mode === 'agent') {
        throw new BlockedError(
          `Aguardando pesquisa do agente em ${rel(ctx.p.candidates)} (formato: src/schemas.ts → CandidatesFile; instrucoes: prompts/pesquisa.md).`,
        );
      }
      const history = loadHistory().map((h) => h.productSlug);
      const prompt = fs.readFileSync(path.join(ROOT, 'prompts', 'pesquisa.md'), 'utf8').replace('{{HISTORICO}}', history.join(', ') || 'nenhum');
      const {data, usage} = await generateJson(ctx.cfg, {
        system: 'Voce e um pesquisador de produtos rigoroso. Nunca invente URLs, precos ou licencas.',
        prompt,
        schema: CandidatesFile,
        webSearch: true,
      });
      writeJsonAtomic(ctx.p.candidates, data);
      const price = PRICE_PER_MTOK[ctx.cfg.providers.llm.anthropic.model];
      addCost(ctx.state, {stage: 'research', item: 'anthropic-tokens', kind: 'observed', amount: usage.inputTokens + usage.outputTokens, unit: 'tokens', basis: 'usage retornado pela API'});
      if (price) {
        addCost(ctx.state, {
          stage: 'research',
          item: 'anthropic-usd',
          kind: 'estimated',
          amount: (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1e6 + usage.webSearches * 0.01,
          unit: 'USD',
          basis: 'tokens observados x preco de tabela; web search a US$10/1000 buscas (conferir tabela vigente)',
        });
      }
    }
    const file = CandidatesFile.parse(readJson(ctx.p.candidates));
    // Integridade referencial: fatos citam fontes existentes.
    for (const c of file.candidates) {
      const ids = new Set(c.sources.map((s) => s.id));
      for (const f of c.facts) for (const s of f.sourceIds) if (!ids.has(s)) throw new Error(`${c.slug}: fato ${f.id} cita fonte inexistente ${s}`);
      if (c.price && !ids.has(c.price.sourceId)) throw new Error(`${c.slug}: preco cita fonte inexistente ${c.price.sourceId}`);
    }
    let note = `${file.candidates.length} candidatos validados`;
    if (!ctx.flags.offline) {
      const urls = [...new Set(file.candidates.flatMap((c) => c.sources.map((s) => s.url)))];
      const status = await linkCheck(urls);
      const bad = Object.entries(status).filter(([, s]) => typeof s !== 'number' || s >= 400);
      writeJsonAtomic(path.join(ctx.p.dir, 'research', 'link-check.json'), {checkedAt: new Date().toISOString(), status});
      note += `; links: ${urls.length - bad.length}/${urls.length} responderam < 400`;
      if (bad.length) log.warn(`Fontes sem resposta OK (sites de loja costumam bloquear robos; conferir manualmente): ${bad.map(([u, s]) => `${u} → ${s}`).join('; ')}`);
    }
    return {outputs: [rel(ctx.p.candidates)], note};
  },
};
