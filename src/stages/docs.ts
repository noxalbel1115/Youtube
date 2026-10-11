// Documentos legiveis do episodio (gerados a partir dos JSON validados): roteiro e registro de fontes/midias.
import {Script, Timeline, Product, MediaRegistry, Selection, CandidatesFile, VoiceManifest} from '../schemas.js';
import {voiceCredit} from '../providers/tts/index.js';
import {readJson} from '../core/state.js';
import {licenseLabel} from '../providers/media/verify.js';
import type {Ctx} from './types.js';

const tc = (frame: number, fps: number) => {
  const s = frame / fps;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
const clean = (s: string) => s.replace(/­/g, '');

export function roteiroMd(ctx: Ctx): string {
  const s = Script.parse(readJson(ctx.p.script));
  const t = Timeline.parse(readJson(ctx.p.timeline));
  const product = Product.parse(readJson(ctx.p.product));
  const facts = new Map(product.facts.map((f) => [f.id, f]));
  const out: string[] = [];
  out.push(`# Roteiro — ${s.workingTitle}`, '');
  out.push(`Episódio \`${s.episodeId}\` · versão ${s.version} · duração final ${(t.durationInFrames / t.fps).toFixed(1)} s`, '');
  out.push(`**Logline.** ${s.logline}`, '');
  out.push('**Progressão.**', ...s.arc.map((a, i) => `${i + 1}. ${a}`), '');
  out.push('Legenda: **[FATO fN]** = afirmação sobre o produto real, ancorada em fonte; *[ficção]* = personagem, opinião ou exagero do vendedor.', '');
  out.push('| Tempo | Beat | Quem | Fala / som | Imagem | Classificação |', '|---|---|---|---|---|---|');
  for (const b of s.beats) {
    const tb = t.beats.find((x) => x.id === b.id)!;
    const v = b.visual;
    const img =
      v.type === 'media'
        ? `foto ${v.mediaId} (${v.layout}, ${v.motion}${v.zoom !== 1 ? `, zoom ${v.zoom}` : ''})`
        : v.type === 'black'
          ? 'tela preta'
          : `${v.type}: ${clean(v.heading ?? '')}${v.stamp ? ` · carimbo "${v.stamp}"` : ''}`;
    const pauses = [b.holdBefore ? `pausa ${b.holdBefore}s antes` : '', b.text && b.holdAfter ? `pausa ${b.holdAfter}s` : ''].filter(Boolean).join(', ');
    const sfx = b.sfx.length ? ` [som: ${b.sfx.map((x) => x.id).join(', ')}]` : '';
    const fala = b.text ? `${clean(b.caption ?? b.text)}${sfx}${pauses ? ` _(${pauses})_` : ''}` : `_(sem fala, ${b.duration}s)_${sfx}`;
    const cls = b.claim === 'fact' ? `**[FATO ${b.factIds.join(', ')}]**` : b.text ? '*[ficção]*' : '—';
    out.push(`| ${tc(tb.startFrame, t.fps)} | ${b.id} | ${b.speaker ?? '—'} | ${fala.replace(/\|/g, '\\|')} | ${img.replace(/\|/g, '\\|')} | ${cls} |`);
  }
  out.push('', '## Fatos usados', '');
  const used = new Set(s.beats.flatMap((b) => b.factIds));
  for (const id of [...used].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
    const f = facts.get(id)!;
    out.push(`- **${id}** — ${f.text} _(fontes: ${f.sourceIds.join(', ')})_`);
  }
  out.push('', '## Notas de direção', '', ...s.beats.filter((b) => b.note).map((b) => `- **${b.id}**: ${b.note}`));
  out.push('', '## Histórico', '', ...s.changelog.map((c) => `- v${c.version}: ${c.note}`), '');
  return out.join('\n');
}

export function fontesMd(ctx: Ctx): string {
  const product = Product.parse(readJson(ctx.p.product));
  const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
  const selection = Selection.parse(readJson(ctx.p.selection));
  const cands = CandidatesFile.parse(readJson(ctx.p.candidates));
  const s = Script.parse(readJson(ctx.p.script));
  const used = new Set(s.beats.filter((b) => b.visual.type === 'media').map((b) => b.visual.mediaId));
  const out: string[] = [];
  out.push(`# Fontes e registro de mídias — ${product.name}`, '');
  out.push(`Pesquisa de ${cands.researchedAt}. Método: ${cands.method}`, '');
  out.push('## Produto', '', `- **O que é:** ${product.description}`, `- **Uso legítimo / público:** ${product.legitimateUse}`, `- **Risco de a piada atingir quem não deve:** ${product.punchingDownRisk}`);
  if (product.price) out.push(`- **Preço consultado:** ${product.price.currency} ${product.price.amount.toFixed(2).replace('.', ',')} em ${product.price.observedAt} (fonte ${product.price.sourceId}). ${product.price.note ?? ''}`);
  out.push('', '## Fontes', '', '| id | Fonte | Tipo | Consulta | O que confirma |', '|---|---|---|---|---|');
  for (const src of product.sources) out.push(`| ${src.id} | [${src.publisher}: ${src.title}](${src.url}) | ${src.kind} | ${src.accessedAt} | ${src.confirms.replace(/\|/g, '/')} |`);
  out.push('', '## Fatos verificados', '', ...product.facts.map((f) => `- **${f.id}** — ${f.text} _(fontes: ${f.sourceIds.join(', ')})_`));
  out.push('', '## Mídias', '', '| id | No vídeo? | Status | Licença | Autor | Origem | Verificação | Condições |', '|---|---|---|---|---|---|---|---|');
  for (const m of registry.items) {
    out.push(
      `| ${m.id} | ${used.has(m.id) ? 'sim' : 'não'} | ${m.status}${m.excludedReason ? ` (${m.excludedReason})` : ''} | ${licenseLabel(m.license, m.licenseVersion)} | ${m.creator} | [página](${m.landingUrl}) | ${m.verification.method.replace(/\|/g, '/')}; ${m.verification.at.slice(0, 10)}; sha256 ${m.sha256?.slice(0, 12) ?? '—'} | ${m.conditions.join(' ').replace(/\|/g, '/')} |`,
    );
  }
  out.push('', 'O que cada mídia mostra:', '', ...registry.items.map((m) => `- **${m.id}** — ${m.description}`));
  const voiceProviders = [...new Set(VoiceManifest.parse(readJson(ctx.p.voice)).lines.map((l) => l.provider))];
  out.push('', `Grafismos, cartelas e efeitos sonoros: produzidos pelo projeto (código em \`src/remotion\` e \`src/sfx.ts\`). ${voiceCredit(voiceProviders, ctx.cfg)}`, '');
  out.push('## Seleção', '', selection.rationale, '', '| Candidato | Pontuação | Elegível | Motivos |', '|---|---|---|---|');
  for (const r of selection.ranking) out.push(`| ${r.slug} | ${r.score} | ${r.eligible ? 'sim' : 'não'} | ${r.reasons.join('; ').replace(/\|/g, '/')} |`);
  out.push('');
  return out.join('\n');
}
