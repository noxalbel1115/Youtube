import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {Timeline} from '../schemas.js';
import {readJson, sha256, sha256File, recordArtifact} from '../core/state.js';
import {ROOT, rel} from '../core/paths.js';
import {run} from '../core/exec.js';
import {log} from '../core/log.js';
import {webpackOverride} from '../remotion/webpack-override.js';
import type {Stage, Ctx} from './types.js';

/** Usa o Chromium headless ja instalado, se houver; senao o Remotion baixa o chrome-headless-shell. */
export function browserExecutable(): string | null {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const candidates = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

let bundled: {publicDir: string; url: string} | null = null;

export async function bundleFor(publicDir: string): Promise<string> {
  if (bundled && bundled.publicDir === publicDir) return bundled.url;
  const url = await bundle({entryPoint: path.join(ROOT, 'src', 'remotion', 'index.ts'), publicDir, webpackOverride, onProgress: () => undefined});
  bundled = {publicDir, url};
  return url;
}

/** Normalizacao de loudness em duas passagens (EBU R128) para o alvo do canal; video copiado sem recodificar. */
export async function loudnorm(input: string, output: string, target: number, tp: number): Promise<{measured: any}> {
  const pass1 = await run('ffmpeg', ['-hide_banner', '-i', input, '-af', `loudnorm=I=${target}:TP=${tp}:LRA=11:print_format=json`, '-f', 'null', '-'], {allowFail: false});
  const json = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{'), pass1.stderr.lastIndexOf('}') + 1));
  const af = `loudnorm=I=${target}:TP=${tp}:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
  await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-c:v', 'copy', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  return {measured: json};
}

export async function renderThumbnail(ctx: Ctx, frame: number, text?: string): Promise<string> {
  const timeline = Timeline.parse(readJson(ctx.p.timeline));
  const serveUrl = await bundleFor(ctx.p.assets);
  // As props precisam ir ja na selecao: o renderStill usa as props resolvidas da composicao.
  const inputProps = {...timeline, thumbnailFrame: frame, thumbnailText: text} as any;
  const comp = await selectComposition({serveUrl, id: 'Thumbnail', inputProps, browserExecutable: browserExecutable()});
  await renderStill({composition: comp, serveUrl, output: ctx.p.thumbnail, inputProps, browserExecutable: browserExecutable()});
  return ctx.p.thumbnail;
}

export const renderStage: Stage = {
  name: 'render',
  inputHash(ctx) {
    const src = fs
      .readdirSync(path.join(ROOT, 'src', 'remotion'), {recursive: true})
      .map(String)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .sort()
      .map((f) => fs.readFileSync(path.join(ROOT, 'src', 'remotion', f), 'utf8'))
      .join('\n');
    // Inclui registro de midias (hash dos originais) e manifesto de voz: arquivos com mesmo nome e conteudo novo invalidam o render.
    return sha256(fs.readFileSync(ctx.p.timeline, 'utf8') + fs.readFileSync(ctx.p.mediaRegistry, 'utf8') + fs.readFileSync(ctx.p.voice, 'utf8') + src + JSON.stringify(ctx.cfg.format));
  },
  async run(ctx) {
    const timeline = Timeline.parse(readJson(ctx.p.timeline));
    const exe = browserExecutable();
    log.info(`navegador: ${exe ?? 'chrome-headless-shell baixado pelo Remotion'}`);
    const t0 = Date.now();
    const serveUrl = await bundleFor(ctx.p.assets);
    const comp = await selectComposition({serveUrl, id: 'Episode', inputProps: timeline as any, browserExecutable: exe});
    let lastPct = -10;
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: 'h264',
      crf: 18,
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      outputLocation: ctx.p.renderRaw,
      inputProps: timeline as any,
      browserExecutable: exe,
      concurrency: Math.max(1, Math.min(4, (await import('node:os')).cpus().length)),
      onProgress: ({progress}) => {
        const pct = Math.floor(progress * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          log.info(`render ${pct}%`);
        }
      },
    });
    const renderSeconds = (Date.now() - t0) / 1000;
    const {measured} = await loudnorm(ctx.p.renderRaw, ctx.p.render, ctx.cfg.format.loudnessTargetLufs, ctx.cfg.format.truePeakDb);
    recordArtifact(ctx.state, 'render', ctx.p.render, ctx.p.dir);
    return {
      outputs: [rel(ctx.p.render)],
      note: `render ${renderSeconds.toFixed(0)}s; loudness antes da normalizacao ${measured.input_i} LUFS; sha256 ${sha256File(ctx.p.render).slice(0, 12)}`,
    };
  },
};
