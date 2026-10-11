import fs from 'node:fs';
import path from 'node:path';
import {Script, Timeline, Product, MediaRegistry, VoiceManifest} from '../schemas.js';
import {voiceCredit} from '../providers/tts/index.js';
import {readJson, sha256, sha256File, writeJsonAtomic} from '../core/state.js';
import {rel} from '../core/paths.js';
import {renderThumbnail} from './render.js';
import {roteiroMd, fontesMd, publicacaoManualMd} from './docs.js';
import type {Stage, Ctx} from './types.js';
import {localeFor, type Language} from '../core/locale.js';
import {attributionText, MODIFICATIONS} from './media.js';

/** Arquivo de legendas do pacote no idioma do episodio. */
export const captionsFile = (language: Language) => `captions.${language}.srt`;

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

function formatDate(iso: string, language: Language = 'pt-BR'): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (language === 'pt-BR') return `${d}/${m}/${y}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

/** Limite de bytes da descricao no YouTube. */
export const DESCRIPTION_LIMIT = 5000;

export function buildDescription(ctx: Ctx): string {
  const script = Script.parse(readJson(ctx.p.script));
  const product = Product.parse(readJson(ctx.p.product));
  const registry = MediaRegistry.parse(readJson(ctx.p.mediaRegistry));
  const loc = localeFor(ctx.cfg, script.language);
  const T = loc.text;
  const date = (iso: string) => formatDate(iso, script.language);
  const used = new Set(script.beats.filter((b) => b.visual.type === 'media').map((b) => b.visual.mediaId));
  const ttsProviders = [...new Set(VoiceManifest.parse(readJson(ctx.p.voice)).lines.map((l) => l.provider))];
  const lines: string[] = [];
  lines.push(script.packaging.synopsis, '');
  lines.push(`${loc.channel.motto}`, '');
  lines.push(T.about);
  lines.push(T.realProduct(script.packaging.productName ?? product.name, product.brand));
  lines.push(T.notAd);
  lines.push(T.checked(date(product.verifiedAt)));
  if (product.price) {
    const src = product.sources.find((s) => s.id === product.price!.sourceId);
    lines.push(T.price(product.price.currency, product.price.amount.toFixed(2), date(product.price.observedAt), src?.publisher ?? 'fonte'));
  }
  const head = lines.length;
  const tail: string[] = [];
  tail.push('', T.imageCredits);
  // O registro de midias guarda o credito em portugues; em outro idioma, o credito e montado com os mesmos campos.
  for (const it of registry.items.filter((i) => used.has(i.id))) {
    tail.push(`• ${script.language === 'pt-BR' ? it.attribution : attributionText(it, MODIFICATIONS[script.language], script.language)}`);
  }
  tail.push('', T.production);
  tail.push(`${voiceCredit(ttsProviders, ctx.cfg, script.language)} ${T.graphics}`);
  tail.push('', `ref: ${idempotencyKey(ctx)}`);
  // Fontes completas (com titulo) quando cabem no limite do YouTube; senao, uma linha curta por fonte (editora e endereco).
  const full = ['', T.sources, ...product.sources.map((s) => `• ${s.publisher}: ${s.title} — ${s.url} (${T.accessed(date(s.accessedAt))})`)];
  const dates = [...new Set(product.sources.map((s) => date(s.accessedAt)))];
  const compact = ['', T.sources, `(${T.accessed(dates.join(', '))})`, ...product.sources.map((s) => `• ${s.publisher} — ${s.url}`)];
  const fits = (src: string[]) => Buffer.byteLength([...lines.slice(0, head), ...src, ...tail].join('\n'), 'utf8') <= DESCRIPTION_LIMIT;
  return [...lines.slice(0, head), ...(fits(full) ? full : compact), ...tail].join('\n');
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
    if (Buffer.byteLength(description, 'utf8') > DESCRIPTION_LIMIT) throw new Error(`descricao com ${Buffer.byteLength(description)} bytes (limite do YouTube: ${DESCRIPTION_LIMIT})`);
    const tags = script.packaging.tags;
    if (tags.join(',').length > 500) throw new Error('tags excedem 500 caracteres');
    const metadata = {
      title: script.packaging.title,
      description,
      tags,
      categoryId: ctx.cfg.youtube.categoryId,
      defaultLanguage: script.language,
      privacyStatus: ctx.cfg.youtube.defaultPrivacyStatus,
      selfDeclaredMadeForKids: ctx.cfg.youtube.selfDeclaredMadeForKids,
      containsSyntheticMedia: ctx.cfg.youtube.containsSyntheticMedia,
      idempotencyKey: idempotencyKey(ctx),
      videoFile: rel(ctx.p.render),
      videoSha256: sha256File(ctx.p.render),
    };
    writeJsonAtomic(path.join(ctx.p.packageDir, 'metadata.json'), metadata);
    fs.writeFileSync(path.join(ctx.p.packageDir, 'description.txt'), description + '\n');
    fs.writeFileSync(path.join(ctx.p.packageDir, captionsFile(script.language)), buildSrt(t));
    fs.writeFileSync(path.join(ctx.p.packageDir, 'roteiro.md'), roteiroMd(ctx));
    fs.writeFileSync(path.join(ctx.p.packageDir, 'fontes-e-midias.md'), fontesMd(ctx));
    fs.writeFileSync(path.join(ctx.p.packageDir, 'publicacao-manual.md'), publicacaoManualMd(ctx, metadata));
    const beat = t.beats.find((b) => b.id === script.packaging.thumbnailBeatId);
    if (!beat) throw new Error(`thumbnailBeatId ${script.packaging.thumbnailBeatId} inexistente`);
    await renderThumbnail(ctx, beat.startFrame + Math.floor(beat.durationFrames / 2), script.packaging.title.split('|')[0].trim());
    return {
      outputs: [rel(path.join(ctx.p.packageDir, 'metadata.json')), rel(path.join(ctx.p.packageDir, captionsFile(script.language))), rel(ctx.p.thumbnail)],
      note: `titulo: "${metadata.title}"; descricao ${Buffer.byteLength(description)} bytes`,
    };
  },
};
