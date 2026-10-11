import fs from 'node:fs';
import path from 'node:path';
import {Script, Timeline, Product, MediaRegistry, VoiceManifest} from '../schemas.js';
import {voiceCredit} from '../providers/tts/index.js';
import {readJson, sha256, sha256File, writeJsonAtomic} from '../core/state.js';
import {rel} from '../core/paths.js';
import {renderThumbnail} from './render.js';
import {roteiroMd, fontesMd} from './docs.js';
import type {Stage, Ctx} from './types.js';

function srtTime(frame: number, fps: number): string {
  const ms = Math.round((frame / fps) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function buildSrt(t: ReturnType<typeof Timeline.parse>): string {
  return t.captions.map((c, i) => `${i + 1}\n${srtTime(c.startFrame, t.fps)} --> ${srtTime(c.endFrame, t.fps)}\n${c.speaker === 'colega' ? '— ' : ''}${c.text.replace(/\u00ad/g, '')}\n`).join('\n');
}

/** Chave de idempotencia gravada na descricao: permite reconciliar uploads apos timeout. */
export function idempotencyKey(ctx: Ctx): string {
  return `dnn-${ctx.id}-${sha256File(ctx.p.render).slice(0, 10)}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function buildDescription(ctx: Ctx): string {
  const script = Script.parse(readJson(ctx.p.script));
  const product = Product.parse(readJson(ctx.p.product));
  const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
  const used = new Set(script.beats.filter((b) => b.visual.type === 'media').map((b) => b.visual.mediaId));
  const ttsProviders = [...new Set(VoiceManifest.parse(readJson(ctx.p.voice)).lines.map((l) => l.provider))];
  const lines: string[] = [];
  lines.push(script.packaging.synopsis, '');
  lines.push(`${ctx.cfg.channel.motto}`, '');
  lines.push('— Sobre este vídeo —');
  lines.push(`O vendedor e a colega são personagens fictícios. O produto é real: ${product.name}. ${product.brand}.`);
  lines.push('Não é publicidade: não há patrocínio nem relação com fabricantes ou lojas citados. As fotos têm licença livre e são creditadas abaixo.');
  lines.push(`As informações factuais sobre o produto foram conferidas nas fontes abaixo em ${formatDate(product.verifiedAt)}.`);
  if (product.price) {
    const src = product.sources.find((s) => s.id === product.price!.sourceId);
    lines.push(`Preço consultado: ${product.price.currency} ${product.price.amount.toFixed(2).replace('.', ',')} em ${formatDate(product.price.observedAt)} (${src?.publisher ?? 'fonte'}). Preços mudam.`);
  }
  lines.push('', '— Fontes —');
  for (const s of product.sources) lines.push(`• ${s.publisher}: ${s.title} — ${s.url} (consultado em ${formatDate(s.accessedAt)})`);
  lines.push('', '— Créditos de imagem —');
  for (const it of registry.items.filter((i) => used.has(i.id))) lines.push(`• ${it.attribution}`);
  lines.push('', '— Produção —');
  lines.push(`${voiceCredit(ttsProviders, ctx.cfg)} Efeitos sonoros e grafismos produzidos pelo canal.`);
  lines.push('', `ref: ${idempotencyKey(ctx)}`);
  return lines.join('\n');
}

export const packageStage: Stage = {
  name: 'package',
  inputHash(ctx) {
    return sha256([ctx.p.script, ctx.p.product, ctx.p.mediaRegistry, ctx.p.timeline].map((f) => fs.readFileSync(f, 'utf8')).join('\n') + sha256File(ctx.p.render) + JSON.stringify(ctx.cfg.youtube));
  },
  async run(ctx) {
    const script = Script.parse(readJson(ctx.p.script));
    const t = Timeline.parse(readJson(ctx.p.timeline));
    fs.mkdirSync(ctx.p.packageDir, {recursive: true});
    const description = buildDescription(ctx);
    if (Buffer.byteLength(description, 'utf8') > 5000) throw new Error(`descricao com ${Buffer.byteLength(description)} bytes (limite do YouTube: 5000)`);
    const tags = script.packaging.tags;
    if (tags.join(',').length > 500) throw new Error('tags excedem 500 caracteres');
    const metadata = {
      title: script.packaging.title,
      description,
      tags,
      categoryId: ctx.cfg.youtube.categoryId,
      defaultLanguage: 'pt-BR',
      privacyStatus: ctx.cfg.youtube.defaultPrivacyStatus,
      selfDeclaredMadeForKids: ctx.cfg.youtube.selfDeclaredMadeForKids,
      containsSyntheticMedia: ctx.cfg.youtube.containsSyntheticMedia,
      idempotencyKey: idempotencyKey(ctx),
      videoFile: rel(ctx.p.render),
      videoSha256: sha256File(ctx.p.render),
    };
    writeJsonAtomic(path.join(ctx.p.packageDir, 'metadata.json'), metadata);
    fs.writeFileSync(path.join(ctx.p.packageDir, 'description.txt'), description + '\n');
    fs.writeFileSync(path.join(ctx.p.packageDir, 'captions.pt-BR.srt'), buildSrt(t));
    fs.writeFileSync(path.join(ctx.p.packageDir, 'roteiro.md'), roteiroMd(ctx));
    fs.writeFileSync(path.join(ctx.p.packageDir, 'fontes-e-midias.md'), fontesMd(ctx));
    const beat = t.beats.find((b) => b.id === script.packaging.thumbnailBeatId);
    if (!beat) throw new Error(`thumbnailBeatId ${script.packaging.thumbnailBeatId} inexistente`);
    await renderThumbnail(ctx, beat.startFrame + Math.floor(beat.durationFrames / 2), script.packaging.title.split('|')[0].trim());
    return {
      outputs: [rel(path.join(ctx.p.packageDir, 'metadata.json')), rel(path.join(ctx.p.packageDir, 'captions.pt-BR.srt')), rel(ctx.p.thumbnail)],
      note: `titulo: "${metadata.title}"; descricao ${Buffer.byteLength(description)} bytes`,
    };
  },
};
