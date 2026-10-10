// Testes do upload idempotente com API falsa: timeout no meio, sessao concluida sem resposta,
// sessao expirada com video ja no canal, travas de autorizacao.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performUpload, uploadGate, type YoutubeOps} from '../src/stages/upload.js';
import {newState, sha256File} from '../src/core/state.js';
import {loadConfig} from '../src/core/config.js';
import {BlockedError, type Ctx} from '../src/stages/types.js';

function makeCtx(overrides: Partial<Ctx['flags']> = {}, yt: Partial<ReturnType<typeof loadConfig>['youtube']> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnn-'));
  const render = path.join(dir, 'episode.mp4');
  fs.writeFileSync(render, Buffer.alloc(1000, 7));
  const packageDir = path.join(dir, 'package');
  fs.mkdirSync(packageDir);
  const sha = sha256File(render);
  fs.writeFileSync(
    path.join(packageDir, 'metadata.json'),
    JSON.stringify({title: 't', description: 'd\nref: dnn-ep001-x', tags: [], categoryId: '23', defaultLanguage: 'pt-BR', selfDeclaredMadeForKids: false, containsSyntheticMedia: true, idempotencyKey: 'dnn-ep001-x', videoSha256: sha}),
  );
  const verifyReport = path.join(dir, 'verify-report.json');
  fs.writeFileSync(verifyReport, JSON.stringify({sha256: sha, manualReview: {status: 'aprovado', sha256: sha}}));
  const base = loadConfig();
  const cfg = {...base, youtube: {...base.youtube, uploadEnabled: true, ...yt}};
  const state = newState('ep001-teste');
  let saves = 0;
  const ctx = {
    id: 'ep001-teste',
    state,
    cfg,
    p: {render, packageDir, verifyReport} as any,
    flags: {force: new Set<string>(), confirmUpload: true, ...overrides},
    save: () => {
      saves++;
    },
  } as Ctx;
  return {ctx, saves: () => saves};
}

function fakeOps(behavior: {failUploadOnce?: boolean; channelHas?: string; session?: 'complete' | 'incomplete' | 'expired'}) {
  const calls: string[] = [];
  let uploads = 0;
  let failed = false;
  const ops: YoutubeOps = {
    token: async () => 'tok',
    createUploadSession: async (_t, m) => {
      calls.push(`create:${m.privacyStatus}`);
      return 'https://upload/session/1';
    },
    querySession: async () => {
      calls.push('query');
      if (behavior.session === 'complete') return {state: 'complete', video: {id: 'VID_FROM_SESSION'}};
      if (behavior.session === 'incomplete') return {state: 'incomplete', nextByte: 400};
      return {state: 'expired'};
    },
    uploadFrom: async (_t, _u, _f, start) => {
      calls.push(`upload@${start}`);
      if (behavior.failUploadOnce && !failed) {
        failed = true;
        throw new Error('timeout');
      }
      uploads++;
      return {id: `VID${uploads}`};
    },
    findByMarker: async () => {
      calls.push('find');
      return behavior.channelHas ? {videoId: behavior.channelHas} : null;
    },
    getVideo: async () => null,
    listCaptions: async () => [],
    insertCaptions: async () => 'cap',
    setThumbnail: async () => undefined,
  };
  return {ops, calls, uploads: () => uploads};
}

test('privacidade padrao e private e e sempre enviada explicitamente', async () => {
  const {ctx} = makeCtx();
  const f = fakeOps({});
  const r = await performUpload(ctx, f.ops);
  assert.equal(r.videoId, 'VID1');
  assert.deepEqual(f.calls, ['create:private', 'upload@0']);
  assert.equal(ctx.state.youtube.privacyStatus, 'private');
});

test('timeout no upload: a reexecucao consulta a sessao salva e nao cria outra', async () => {
  const {ctx} = makeCtx();
  const f = fakeOps({failUploadOnce: true});
  await assert.rejects(performUpload(ctx, f.ops), /timeout/);
  assert.equal(ctx.state.youtube.status, 'uploading');
  assert.ok(ctx.state.youtube.uploadSessionUri, 'URI da sessao persistida antes do envio');
  // A API informa que o upload na verdade terminou (resposta perdida no timeout)
  const f2 = fakeOps({session: 'complete'});
  const r = await performUpload(ctx, f2.ops);
  assert.equal(r.videoId, 'VID_FROM_SESSION');
  assert.ok(!f2.calls.some((c) => c.startsWith('create')), 'nao criou nova sessao');
  assert.ok(!f2.calls.some((c) => c.startsWith('upload')), 'nao reenviou bytes');
});

test('sessao incompleta: retoma do byte informado pela API', async () => {
  const {ctx} = makeCtx();
  ctx.state.youtube = {status: 'uploading', uploadSessionUri: 'https://upload/session/1'};
  const f = fakeOps({session: 'incomplete'});
  await performUpload(ctx, f.ops);
  assert.deepEqual(f.calls, ['query', 'upload@400']);
});

test('sessao expirada e video ja no canal: adota pelo marcador, sem reenviar', async () => {
  const {ctx} = makeCtx();
  ctx.state.youtube = {status: 'uploading', uploadSessionUri: 'https://upload/session/old'};
  const f = fakeOps({session: 'expired', channelHas: 'VID_EXISTING'});
  const r = await performUpload(ctx, f.ops);
  assert.equal(r.videoId, 'VID_EXISTING');
  assert.deepEqual(f.calls, ['query', 'find']);
});

test('video ja enviado para o mesmo arquivo: nada acontece', async () => {
  const {ctx} = makeCtx();
  ctx.state.youtube = {status: 'uploaded', videoId: 'VID9', uploadedFileSha256: sha256File(ctx.p.render)};
  const f = fakeOps({});
  const r = await performUpload(ctx, f.ops);
  assert.equal(r.videoId, 'VID9');
  assert.deepEqual(f.calls, []);
});

test('travas: sem flag, sem config, publico e agendamento bloqueados por padrao', () => {
  assert.throws(() => uploadGate(makeCtx({confirmUpload: false}).ctx), BlockedError);
  assert.throws(() => uploadGate(makeCtx({}, {uploadEnabled: false}).ctx), BlockedError);
  assert.throws(() => uploadGate(makeCtx({privacy: 'public'}).ctx), BlockedError);
  assert.throws(() => uploadGate(makeCtx({publishAt: new Date(Date.now() + 86400000).toISOString()}).ctx), BlockedError);
  const ok = uploadGate(makeCtx({publishAt: new Date(Date.now() + 86400000).toISOString()}, {allowScheduledPublish: true}).ctx);
  assert.equal(ok.privacyStatus, 'private');
  assert.ok(ok.publishAt);
});

test('revisao humana pendente bloqueia upload', () => {
  const {ctx} = makeCtx();
  fs.writeFileSync(ctx.p.verifyReport, JSON.stringify({sha256: sha256File(ctx.p.render), manualReview: {status: 'pendente'}}));
  assert.throws(() => uploadGate(ctx), /Revisao humana/);
});
