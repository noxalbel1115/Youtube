// Provedor opcional: chama a API da Anthropic diretamente (pesquisa com web search e roteiro).
// So e usado quando config.providers.llm.{research,script} = "anthropic". Gera custo por token:
// exige ANTHROPIC_API_KEY e budget.maxUsdPerEpisode > 0. NAO validado neste repositorio sem credencial.
import Anthropic from '@anthropic-ai/sdk';
import type {z} from 'zod';
import type {Config} from '../../core/config.js';
import {BlockedError} from '../../stages/types.js';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

function client(cfg: Config): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new BlockedError('Provedor "anthropic" configurado, mas ANTHROPIC_API_KEY nao esta definida.');
  }
  if (cfg.budget.maxUsdPerEpisode <= 0) {
    throw new BlockedError('Provedor "anthropic" gera custo, mas budget.maxUsdPerEpisode = 0 (sem orcamento autorizado).');
  }
  return new Anthropic();
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

/**
 * Executa um pedido com web search (opcional) e devolve JSON validado pelo schema zod.
 * Uma tentativa de reparo e feita se o JSON vier invalido.
 */
export async function generateJson<T>(
  cfg: Config,
  opts: {system: string; prompt: string; schema: z.ZodType<T>; webSearch: boolean},
): Promise<{data: T; usage: LlmUsage}> {
  const anthropic = client(cfg);
  const model = cfg.providers.llm.anthropic.model;
  const usage: LlmUsage = {inputTokens: 0, outputTokens: 0, webSearches: 0};
  const tools: Anthropic.Beta.BetaToolUnion[] = opts.webSearch ? [{type: 'web_search_20260209', name: 'web_search', max_uses: 25}] : [];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{role: 'user', content: opts.prompt}];

  let text = '';
  for (let turn = 0; turn < 6; turn++) {
    const stream = anthropic.beta.messages.stream({
      model,
      max_tokens: cfg.providers.llm.anthropic.maxTokens,
      system: opts.system,
      thinking: {type: 'adaptive'},
      output_config: {effort: 'high'},
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools,
      messages,
    });
    const msg = await stream.finalMessage();
    usage.inputTokens += msg.usage.input_tokens;
    usage.outputTokens += msg.usage.output_tokens;
    usage.webSearches += msg.usage.server_tool_use?.web_search_requests ?? 0;
    if (msg.stop_reason === 'refusal') throw new Error(`Pedido recusado pelo modelo (${msg.stop_details?.category ?? 'sem categoria'})`);
    messages.push({role: 'assistant', content: msg.content});
    text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    if (msg.stop_reason === 'pause_turn') continue; // web search longo: retomar
    break;
  }

  try {
    return {data: opts.schema.parse(extractJson(text)), usage};
  } catch (err) {
    messages.push({role: 'user', content: `O JSON acima nao passou na validacao: ${String(err).slice(0, 2000)}\nDevolva apenas o JSON corrigido, num bloco \`\`\`json.`});
    const fix = await anthropic.beta.messages.stream({
      model,
      max_tokens: cfg.providers.llm.anthropic.maxTokens,
      system: opts.system,
      thinking: {type: 'adaptive'},
      output_config: {effort: 'medium'},
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    }).finalMessage();
    usage.inputTokens += fix.usage.input_tokens;
    usage.outputTokens += fix.usage.output_tokens;
    const fixed = fix.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return {data: opts.schema.parse(extractJson(fixed)), usage};
  }
}

/** Precos de tabela (USD por milhao de tokens) usados apenas para ESTIMATIVA de custo. */
export const PRICE_PER_MTOK: Record<string, {input: number; output: number}> = {
  'claude-opus-5-5': {input: 4, output: 20},
  'claude-sonnet-5-5': {input: 2, output: 10},
  'claude-haiku-5-5': {input: 0.1, output: 0.5},
};
