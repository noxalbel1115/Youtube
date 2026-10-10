import fs from 'node:fs';
import path from 'node:path';
import {readJson, sha256File, nowIso, addCost} from '../core/state.js';
import {log} from '../core/log.js';
import type {YoutubeState} from '../schemas.js';
import * as yt from '../youtube/client.js';
import {accessToken} from '../youtube/auth.js';
import {BlockedError, type Stage, type Ctx} from './types.js';

/** Operacoes remotas usadas pelo upload. Injetaveis para testes (ver test/upload.test.ts). */
export interface YoutubeOps {
  token(): Promise<string>;
  createUploadSession: typeof yt.createUploadSession;
  querySession: typeof yt.querySession;
  uploadFrom: typeof yt.uploadFrom;
  findByMarker: typeof yt.findByMarker;
  getVideo: typeof yt.getVideo;
  listCaptions: typeof yt.listCaptions;
  insertCaptions: typeof yt.insertCaptions;
  setThumbnail: typeof yt.setThumbnail;
}

export function realOps(ctx: Ctx): YoutubeOps {
  return {token: () => accessToken(ctx.cfg), ...yt};
}

/** Regras de autorizacao. Qualquer duvida = bloqueia (nunca publica por padrao). */
export function uploadGate(ctx: Ctx): {privacyStatus: 'private' | 'unlisted' | 'public'; publishAt?: string} {
  const y = ctx.cfg.youtube;
  if (!y.uploadEnabled) throw new BlockedError('Upload desabilitado (config youtube.uploadEnabled=false). Habilite somente apos autorizacao.');
  if (!ctx.flags.confirmUpload) throw new BlockedError('Upload exige a flag explicita --confirm-upload.');
  const privacyStatus = ctx.flags.privacy ?? y.defaultPrivacyStatus;
  if (privacyStatus === 'public' && !y.allowPublic) throw new BlockedError('Publicacao publica bloqueada (youtube.allowPublic=false).');
  let publishAt: string | undefined;
  if (ctx.flags.publishAt) {
    if (!y.allowScheduledPublish) throw new BlockedError('Publicacao agendada bloqueada (youtube.allowScheduledPublish=false).');
    if (privacyStatus !== 'private') throw new BlockedError('publishAt exige privacyStatus=private (regra da API).');
    const when = new Date(ctx.flags.publishAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 15 * 60 * 1000) throw new BlockedError('publishAt invalido ou a menos de 15 min no futuro (data passada publica imediatamente).');
    publishAt = when.toISOString();
  }
  const review = fs.existsSync(ctx.p.verifyReport) ? readJson<any>(ctx.p.verifyReport) : null;
  if (!review || review.manualReview?.status !== 'aprovado' || review.sha256 !== sha256File(ctx.p.render)) {
    throw new BlockedError('Revisao humana do arquivo final pendente (verify-report.json → manualReview.status = "aprovado" para este sha256).');
  }
  return {privacyStatus, publishAt};
}

/**
 * Upload idempotente. Ordem de decisao:
 * 1. ja existe videoId para este mesmo arquivo → nao reenvia;
 * 2. ha sessao resumivel salva → consulta: concluida (adota o id), incompleta (retoma), expirada (reconcilia);
 * 3. estado incerto sem sessao → reconcilia pelo marcador na descricao antes de criar nova sessao;
 * 4. cria sessao, PERSISTE a URI e so entao envia bytes.
 */
export async function performUpload(ctx: Ctx, ops: YoutubeOps): Promise<{videoId: string; adopted: boolean}> {
  const meta = readJson<any>(path.join(ctx.p.packageDir, 'metadata.json'));
  const file = ctx.p.render;
  const size = fs.statSync(file).size;
  const fileSha = sha256File(file);
  if (meta.videoSha256 !== fileSha) throw new Error('metadata.json foi gerado para outro arquivo; refaca a etapa package');
  const {privacyStatus, publishAt} = uploadGate(ctx);
  const s: YoutubeState = ctx.state.youtube;
  const token = await ops.token();

  if (s.videoId) {
    if (s.uploadedFileSha256 === fileSha) return {videoId: s.videoId, adopted: true};
    throw new BlockedError(`Ja existe video enviado (${s.videoId}) de outra versao do arquivo. Decida manualmente (substituir/excluir) antes de reenviar.`);
  }

  const adopt = (videoId: string, how: string) => {
    s.videoId = videoId;
    s.status = 'uploaded';
    s.uploadedFileSha256 = fileSha;
    s.uploadSessionUri = undefined;
    s.lastCheckedAt = nowIso();
    ctx.save();
    log.info(`video ${videoId} (${how})`);
  };

  if (s.uploadSessionUri) {
    const q = await ops.querySession(token, s.uploadSessionUri, size);
    if (q.state === 'complete') {
      adopt(q.video.id, 'sessao anterior ja havia concluido — nada reenviado');
      return {videoId: q.video.id, adopted: true};
    }
    if (q.state === 'incomplete') {
      log.info(`retomando upload a partir do byte ${q.nextByte}/${size}`);
      s.status = 'uploading';
      ctx.save();
      const video = await ops.uploadFrom(token, s.uploadSessionUri, file, q.nextByte, size);
      adopt(video.id, 'upload retomado');
      return {videoId: video.id, adopted: false};
    }
    s.uploadSessionUri = undefined;
    s.status = 'needs_reconcile';
    ctx.save();
  }

  if (s.status !== 'not_started' && s.status !== 'failed') {
    const found = await ops.findByMarker(token, meta.idempotencyKey);
    s.lastCheckedAt = nowIso();
    if (found) {
      adopt(found.videoId, 'encontrado no canal pelo marcador de idempotencia — nada reenviado');
      return {videoId: found.videoId, adopted: true};
    }
  }

  const uri = await ops.createUploadSession(
    token,
    {
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      categoryId: meta.categoryId,
      defaultLanguage: meta.defaultLanguage,
      privacyStatus,
      publishAt,
      selfDeclaredMadeForKids: meta.selfDeclaredMadeForKids,
      containsSyntheticMedia: meta.containsSyntheticMedia,
    },
    size,
  );
  s.uploadSessionUri = uri;
  s.sessionCreatedAt = nowIso();
  s.idempotencyKey = meta.idempotencyKey;
  s.privacyStatus = privacyStatus;
  s.publishAt = publishAt;
  s.status = 'uploading';
  ctx.save(); // persiste ANTES de enviar bytes: uma queda daqui em diante e recuperavel sem duplicar
  const video = await ops.uploadFrom(token, uri, file, 0, size);
  adopt(video.id, 'enviado');
  return {videoId: video.id, adopted: false};
}

export const uploadStage: Stage = {
  name: 'upload',
  inputHash(ctx) {
    return sha256File(ctx.p.render) + JSON.stringify({p: ctx.flags.privacy, a: ctx.flags.publishAt});
  },
  async run(ctx) {
    const ops = realOps(ctx);
    const s = ctx.state.youtube;
    let quota = 0;
    try {
      const {videoId} = await performUpload(ctx, ops);
      quota += yt.QUOTA.insert + yt.QUOTA.channelsList + yt.QUOTA.playlistItemsList;
      const token = await ops.token();
      // Le de volta o estado remoto: detecta trava "private" de projeto nao auditado, processamento etc.
      const v = await ops.getVideo(token, videoId);
      quota += yt.QUOTA.videosList;
      s.remote = {privacyStatus: v?.status?.privacyStatus, uploadStatus: v?.status?.uploadStatus, publishAt: v?.status?.publishAt, processingStatus: v?.processingDetails?.processingStatus};
      s.lastCheckedAt = nowIso();
      if (v?.status?.privacyStatus && v.status.privacyStatus !== s.privacyStatus) {
        log.warn(`privacidade remota (${v.status.privacyStatus}) difere da pedida (${s.privacyStatus}) — possivel trava de projeto nao auditado`);
      }
      s.status = v?.status?.uploadStatus === 'processed' ? 'processed' : 'processing';
      if (ctx.cfg.youtube.uploadCaptions && s.captions?.status !== 'done') {
        const existing = await ops.listCaptions(token, videoId);
        quota += yt.QUOTA.captionsList;
        const ours = existing.find((c: any) => c.snippet?.name === 'DND pt-BR');
        if (ours) s.captions = {status: 'done', id: ours.id};
        else {
          const id = await ops.insertCaptions(token, videoId, path.join(ctx.p.packageDir, 'captions.pt-BR.srt'), 'DND pt-BR');
          quota += yt.QUOTA.captionsInsert;
          s.captions = {status: 'done', id};
        }
      }
      if (ctx.cfg.youtube.uploadThumbnail && s.thumbnail?.status !== 'done') {
        try {
          await ops.setThumbnail(token, videoId, ctx.p.thumbnail);
          quota += yt.QUOTA.thumbnailsSet;
          s.thumbnail = {status: 'done'};
        } catch (e) {
          s.thumbnail = {status: `falhou: ${(e as Error).message.slice(0, 200)}`};
        }
      }
      ctx.save();
      return {outputs: [], note: `video ${videoId}, privacidade pedida ${s.privacyStatus}, remota ${s.remote?.privacyStatus}`};
    } finally {
      if (quota) addCost(ctx.state, {stage: 'upload', item: 'youtube-quota', kind: 'estimated', amount: quota, unit: 'youtube-quota-units', basis: 'custos de cota documentados por metodo'});
    }
  },
};
