#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {STAGES, type StageName} from './schemas.js';
import {loadConfig, loadDotEnv} from './core/config.js';
import {epPaths, ROOT, PYTHON_BIN, MODELS_DIR, EPISODES_DIR} from './core/paths.js';
import {newState, loadState, saveState, readJson, writeJsonAtomic, sha256File, nowIso} from './core/state.js';
import {run} from './core/exec.js';
import {log} from './core/log.js';
import {runPipeline} from './stages/runner.js';
import {browserExecutable} from './stages/render.js';
import {authorizeInteractive, accessToken} from './youtube/auth.js';
import * as yt from './youtube/client.js';
import {appendHistory} from './stages/select.js';
import {Product} from './schemas.js';
import type {Flags} from './stages/types.js';

loadDotEnv();

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const opts: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts[k] = next;
        i++;
      } else opts[k] = true;
    } else pos.push(a);
  }
  return {pos, opts};
}

const HELP = `Departamento de Necessidades Desnecessarias — pipeline

  npm run dnn -- new <ep001-slug>                 cria episodio
  npm run dnn -- run <id> [--from etapa] [--to etapa] [--force etapa,...|all] [--pick slug] [--offline]
  npm run dnn -- status <id>                      etapa atual, erros, custos, upload
  npm run dnn -- review <id> --approve|--reject [--note "..."]   registra revisao humana do MP4 atual
  npm run dnn -- upload <id> --confirm-upload [--privacy private|unlisted|public] [--publish-at ISO]
  npm run dnn -- reconcile <id>                   consulta o canal (sem enviar nada)
  npm run dnn -- youtube:auth                     autoriza o canal (maquina com navegador)
  npm run dnn -- doctor                           confere dependencias e acesso de rede

Etapas: ${STAGES.join(' → ')} (o run padrao para em "package"; upload so com o comando upload).`;

function flagsFrom(opts: Record<string, string | true>): Flags {
  return {
    force: new Set(typeof opts.force === 'string' ? opts.force.split(',') : opts.force ? ['all'] : []),
    pick: typeof opts.pick === 'string' ? opts.pick : undefined,
    offline: !!opts.offline,
    confirmUpload: !!opts['confirm-upload'],
    privacy: typeof opts.privacy === 'string' ? (opts.privacy as Flags['privacy']) : undefined,
    publishAt: typeof opts['publish-at'] === 'string' ? (opts['publish-at'] as string) : undefined,
  };
}

async function doctor(): Promise<number> {
  const cfg = loadConfig();
  let bad = 0;
  const ok = (name: string, cond: boolean, detail = '') => {
    console.log(`${cond ? 'ok  ' : 'FALTA'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) bad++;
  };
  const ff = await run('ffmpeg', ['-version'], {allowFail: true}).catch(() => ({code: 1, stdout: ''}));
  ok('ffmpeg', ff.code === 0, ff.stdout.split('\n')[0]);
  ok('python venv', fs.existsSync(PYTHON_BIN), PYTHON_BIN);
  ok('modelo Kokoro', fs.existsSync(path.join(ROOT, cfg.providers.tts.kokoro.model)));
  for (const v of Object.values(cfg.providers.tts.voices)) {
    if (v.provider === 'kokoro') ok(`voz ${v.voice}`, fs.existsSync(path.join(ROOT, cfg.providers.tts.kokoro.voicesDir, `${v.voice}.bin`)));
  }
  const exe = browserExecutable();
  ok('navegador para render', true, exe ?? 'sera baixado pelo Remotion (chrome-headless-shell)');
  const hosts = ['https://api.openverse.org/v1/', 'https://api.wikimedia.org/', 'https://upload.wikimedia.org/', 'https://huggingface.co/', 'https://www.googleapis.com/discovery/v1/apis'];
  for (const h of hosts) {
    try {
      const r = await fetch(h, {method: 'GET', signal: AbortSignal.timeout(15000)});
      ok(`rede ${new URL(h).host}`, r.status < 500 && r.status !== 403, `HTTP ${r.status}`);
    } catch (e) {
      ok(`rede ${new URL(h).host}`, false, (e as Error).message);
    }
  }
  ok('YT_CLIENT_ID/SECRET (so para upload)', !!process.env.YT_CLIENT_ID && !!process.env.YT_CLIENT_SECRET, 'opcional ate autorizar o canal');
  ok('youtube.uploadEnabled', true, String(cfg.youtube.uploadEnabled));
  return bad ? 1 : 0;
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  const {pos, opts} = parseArgs(rest);
  const id = pos[0];
  switch (cmd) {
    case 'new': {
      if (!id) throw new Error('uso: new <ep001-slug>');
      const p = epPaths(id);
      if (fs.existsSync(p.state)) throw new Error(`${id} ja existe`);
      fs.mkdirSync(path.join(p.dir, 'research'), {recursive: true});
      saveState(newState(id));
      log.info(`episodio criado em ${path.relative(ROOT, p.dir)}`);
      return 0;
    }
    case 'run': {
      if (!id) throw new Error('uso: run <id>');
      const from = typeof opts.from === 'string' ? (opts.from as StageName) : undefined;
      const to = typeof opts.to === 'string' ? (opts.to as StageName) : undefined;
      for (const s of [from, to]) if (s && !STAGES.includes(s)) throw new Error(`etapa desconhecida: ${s}`);
      if (to === 'upload') throw new Error('use o comando "upload" (exige --confirm-upload)');
      return runPipeline(id, {from, to, flags: flagsFrom(opts)});
    }
    case 'upload': {
      if (!id) throw new Error('uso: upload <id> --confirm-upload');
      const code = await runPipeline(id, {from: 'upload', to: 'upload', flags: {...flagsFrom(opts), force: new Set(['upload'])}});
      if (code === 0) {
        const st = loadState(id);
        const product = Product.parse(readJson(epPaths(id).product));
        appendHistory({episodeId: id, productSlug: product.slug, productName: product.name, date: nowIso().slice(0, 10)});
        log.info(`upload ok: https://youtu.be/${st.youtube.videoId} (${st.youtube.privacyStatus})`);
      }
      return code;
    }
    case 'status': {
      if (!id) {
        for (const d of fs.existsSync(EPISODES_DIR) ? fs.readdirSync(EPISODES_DIR) : []) {
          if (!fs.existsSync(epPaths(d).state)) continue;
          const s = loadState(d);
          console.log(`${d}  etapa=${s.currentStage}  youtube=${s.youtube.status}`);
        }
        return 0;
      }
      const s = loadState(id);
      console.log(`Episodio ${id} — etapa atual: ${s.currentStage} — roteiro v${s.scriptVersion ?? '-'}`);
      for (const st of STAGES) {
        const x = s.stages[st];
        console.log(`  ${st.padEnd(9)} ${x.status.padEnd(8)} ${x.seconds != null ? `${x.seconds}s`.padStart(7) : '       '}  ${x.error ?? x.note ?? ''}`.slice(0, 220));
      }
      console.log('Custos:');
      for (const c of s.costs) console.log(`  [${c.kind === 'observed' ? 'observado' : 'estimado '}] ${c.stage}/${c.item}: ${c.amount} ${c.unit} — ${c.basis}`);
      console.log(`YouTube: ${JSON.stringify(s.youtube)}`);
      if (s.errors.length) console.log(`Ultimo erro: [${s.errors.at(-1)!.stage}] ${s.errors.at(-1)!.message.slice(0, 300)}`);
      return 0;
    }
    case 'review': {
      if (!id || (!opts.approve && !opts.reject)) throw new Error('uso: review <id> --approve|--reject [--note "..."]');
      const p = epPaths(id);
      const report = readJson<any>(p.verifyReport);
      const sha = sha256File(p.render);
      if (report.sha256 !== sha) throw new Error('o MP4 atual nao e o verificado; rode a etapa verify de novo');
      report.manualReview = {
        status: opts.approve ? 'aprovado' : 'reprovado',
        sha256: sha,
        at: nowIso(),
        by: process.env.USER ?? 'humano',
        notes: [...(report.manualReview?.notes ?? []), ...(typeof opts.note === 'string' ? [opts.note] : [])],
      };
      writeJsonAtomic(p.verifyReport, report);
      log.info(`revisao registrada: ${report.manualReview.status}`);
      return 0;
    }
    case 'reconcile': {
      if (!id) throw new Error('uso: reconcile <id>');
      const cfg = loadConfig();
      const s = loadState(id);
      const p = epPaths(id);
      const token = await accessToken(cfg);
      const meta = readJson<any>(path.join(p.packageDir, 'metadata.json'));
      if (s.youtube.uploadSessionUri) {
        const q = await yt.querySession(token, s.youtube.uploadSessionUri, fs.statSync(p.render).size);
        console.log('sessao salva:', q.state, q.state === 'complete' ? q.video.id : '');
      }
      const found = await yt.findByMarker(token, meta.idempotencyKey);
      console.log('busca pelo marcador', meta.idempotencyKey, '→', found ?? 'nao encontrado');
      if (found && !s.youtube.videoId) {
        s.youtube.videoId = found.videoId;
        s.youtube.status = 'uploaded';
        s.youtube.uploadedFileSha256 = meta.videoSha256;
        s.youtube.uploadSessionUri = undefined;
        saveState(s);
        console.log('estado local atualizado com o video encontrado');
      }
      return 0;
    }
    case 'youtube:auth':
      await authorizeInteractive(loadConfig());
      return 0;
    case 'doctor':
      return doctor();
    default:
      console.log(HELP);
      return cmd ? 1 : 0;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    log.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
