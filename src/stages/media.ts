import fs from 'node:fs';
import path from 'node:path';
import {CandidatesFile, MediaRegistry, type MediaItem, type MediaCandidate, type LicenseCode} from '../schemas.js';
import {readJson, sha256, sha256File, writeJsonAtomic, nowIso} from '../core/state.js';
import {rel} from '../core/paths.js';
import {run, ffprobeJson} from '../core/exec.js';
import {log} from '../core/log.js';
import {verifyMedia, licenseUrl, licenseLabel, conditionsFor} from '../providers/media/verify.js';
import type {Stage} from './types.js';
import {STRINGS} from '../core/locale.js';

const UA = 'DNN-pipeline/0.1 (+https://github.com/noxalbel1115/Youtube)';

async function download(url: string, dest: string, attempts = 6): Promise<void> {
  // Material proprio (fotos feitas pelo canal, graficos gerados) pode vir de arquivo local.
  if (url.startsWith('file://')) {
    fs.copyFileSync(new URL(url), dest);
    return;
  }
  // Respeita o Retry-After (a Wikimedia limita trafego anonimo por IP); sem ele, espera exponencial.
  let wait = 2000;
  let last = '';
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(url, {headers: {'user-agent': UA}, signal: AbortSignal.timeout(120000)});
    if (res.ok) {
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return;
    }
    await res.body?.cancel();
    if (res.status !== 429 && res.status < 500) throw new Error(`download HTTP ${res.status}: ${url}`);
    const ra = Number(res.headers.get('retry-after'));
    last = `HTTP ${res.status}${ra ? `, retry-after ${ra}s` : ''}`;
    if (i === attempts) break;
    await new Promise((r) => setTimeout(r, Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : wait));
    wait *= 2;
  }
  throw new Error(`download falhou apos ${attempts} tentativas (${last}): ${url}`);
}

export function attributionText(m: {title: string; creator: string; landingUrl: string; license: LicenseCode; licenseVersion?: string}, modifications: string, by = 'por'): string {
  const lic = licenseLabel(m.license, m.licenseVersion);
  const url = licenseUrl(m.license, m.licenseVersion);
  return `"${m.title}" ${by} ${m.creator} (${m.landingUrl}), ${lic}${url ? ` (${url})` : ''}. ${modifications}`;
}

export const mediaStage: Stage = {
  name: 'media',
  inputHash(ctx) {
    const sel = readJson<{slug: string}>(ctx.p.selection);
    const file = CandidatesFile.parse(readJson(ctx.p.candidates));
    const cand = file.candidates.find((c) => c.slug === sel.slug)!;
    return sha256(JSON.stringify(cand.media) + JSON.stringify(ctx.cfg.providers.media));
  },
  async run(ctx) {
    const sel = readJson<{slug: string}>(ctx.p.selection);
    const file = CandidatesFile.parse(readJson(ctx.p.candidates));
    const cand = file.candidates.find((c) => c.slug === sel.slug)!;
    const allowed = new Set(ctx.cfg.providers.media.allowedLicenses);
    const outDir = path.join(ctx.p.assets, 'media');
    fs.mkdirSync(outDir, {recursive: true});
    const items: MediaItem[] = [];
    const {modifications, by} = STRINGS[ctx.state.locale];

    for (const m of cand.media) {
      const base: Omit<MediaItem, 'verification' | 'status'> = {
        ...m,
        basis: allowed.has(m.license) ? 'license' : 'none',
        conditions: conditionsFor(m.license, m.licenseVersion),
        modifications,
        attribution: attributionText(m, modifications, by),
        licenseUrl: m.licenseUrl ?? licenseUrl(m.license, m.licenseVersion),
      };
      let item: MediaItem;
      try {
        const v = await verifyMedia(m as MediaCandidate);
        const verification = {at: nowIso(), method: v.method, ok: v.ok, detail: `${v.detail}${v.creator ? `; autor na origem: ${v.creator}` : ''}`.slice(0, 800)};
        if (!v.ok) {
          item = {...base, verification, status: 'excluded', excludedReason: `licenca nao verificada: ${v.detail}`};
        } else if (!allowed.has(v.license)) {
          item = {...base, license: v.license, verification, status: 'excluded', excludedReason: `licenca ${v.license} fora da lista permitida`};
        } else if (v.license !== m.license) {
          // A origem manda: registra a licenca verificada e avisa a divergencia.
          log.warn(`${m.id}: licenca declarada na pesquisa (${m.license}) difere da origem (${v.license}); usando a da origem`);
          item = {...base, license: v.license, licenseVersion: v.licenseVersion, conditions: conditionsFor(v.license, v.licenseVersion), verification, status: 'usable'};
        } else {
          item = {...base, licenseVersion: v.licenseVersion ?? m.licenseVersion, verification, status: 'usable'};
        }
        if (item.status === 'usable') {
          const url = v.fileUrl ?? m.fileUrl;
          if (!url) throw new Error('sem URL de arquivo');
          const ext = (path.extname(new URL(url).pathname) || '.jpg').toLowerCase();
          const orig = path.join(outDir, `${m.id}.orig${ext}`);
          let via = 'arquivo original';
          if (!fs.existsSync(orig)) {
            // Com rota alternativa (Openverse/CDN), nao vale insistir muito na origem limitada.
            const hasFallback = (m.provider === 'openverse' && !!m.providerRef) || m.provider === 'wikimedia';
            try {
              await download(url, orig, hasFallback ? 2 : 6);
            } catch (e) {
              // Origem bloqueando o IP (429/CIDR): usa o proxy de imagens do Openverse para o mesmo registro.
              if (m.provider === 'openverse' && m.providerRef) {
                log.warn(`${m.id}: download direto falhou (${(e as Error).message}); usando proxy do Openverse`);
                await download(`https://api.openverse.org/v1/images/${m.providerRef}/thumb/?full_size=true&compressed=false`, orig);
                via = 'proxy de imagens do Openverse (mesmo registro)';
              } else if (m.provider === 'wikimedia' && new URL(url).hostname === 'upload.wikimedia.org') {
                // Mesmo arquivo pelo CDN de imagens (Jetpack Photon) que o Openverse usa para o Commons. A licenca ja foi
                // verificada na pagina do arquivo; o CDN pode recomprimir, entao o sha256 e o da copia recebida.
                const u = new URL(url);
                log.warn(`${m.id}: download direto falhou (${(e as Error).message}); usando o CDN i0.wp.com`);
                await download(`https://i0.wp.com/${u.hostname}${u.pathname}?ssl=1`, orig);
                via = 'CDN de imagens i0.wp.com (copia do arquivo original do Commons, possivelmente recomprimida)';
              } else throw e;
            }
          }
          item.verification.detail += `; arquivo obtido via ${via}`;
          const out = path.join(outDir, `${m.id}.jpg`);
          // Normaliza: ate 3200 px no lado maior (sem reduzir fotos comuns), JPEG. O original fica para auditoria (hash registrado).
          await run('ffmpeg', ['-y', '-v', 'error', '-i', orig, '-vf', "scale='if(gt(iw,ih),min(3200,iw),-2)':'if(gt(iw,ih),-2,min(3200,ih))'", '-q:v', '2', out]);
          const probe = await ffprobeJson(out);
          const vs = probe.streams.find((s: any) => s.codec_type === 'video');
          item.localFile = path.relative(ctx.p.assets, out);
          item.sha256 = sha256File(orig);
          item.width = vs?.width;
          item.height = vs?.height;
          item.fileUrl = url;
          item.attribution = attributionText(item, modifications, by);
        }
      } catch (e) {
        item = {
          ...base,
          verification: {at: nowIso(), method: 'erro', ok: false, detail: String((e as Error).message).slice(0, 500)},
          status: 'excluded',
          excludedReason: `falha na verificacao/download: ${(e as Error).message}`.slice(0, 300),
        };
      }
      items.push(item);
      log.info(`midia ${m.id}: ${item.status}${item.excludedReason ? ' — ' + item.excludedReason : ''}`);
    }
    writeJsonAtomic(ctx.p.mediaRegistry, MediaRegistry.parse({updatedAt: nowIso(), items}));
    const usable = items.filter((i) => i.status === 'usable').length;
    if (usable === 0) throw new Error('Nenhuma midia utilizavel apos verificacao de licenca.');
    return {outputs: [rel(ctx.p.mediaRegistry)], note: `${usable}/${items.length} midias utilizaveis`};
  },
};
