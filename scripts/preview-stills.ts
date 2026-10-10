// Renderiza quadros isolados de uma composicao para inspecao visual rapida (sem renderizar o video inteiro).
// Uso: npx tsx scripts/preview-stills.ts <composicao> <pasta-saida> <quadro> [quadro...] [--props timeline.json] [--public pasta]
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {webpackOverride} from '../src/remotion/webpack-override.js';
import {browserExecutable} from '../src/stages/render.js';

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(k);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const propsFile = opt('--props');
const publicDir = opt('--public');
const [id, out, ...frameArgs] = args;
const frames = frameArgs.map(Number);
fs.mkdirSync(out, {recursive: true});
const inputProps = propsFile ? JSON.parse(fs.readFileSync(propsFile, 'utf8')) : {};
const serveUrl = await bundle({entryPoint: path.resolve('src/remotion/index.ts'), webpackOverride, publicDir: publicDir ? path.resolve(publicDir) : undefined});
const exe = browserExecutable();
const chromiumOptions = {gl: 'swangle' as const};
const comp = await selectComposition({serveUrl, id, inputProps, browserExecutable: exe, chromiumOptions});
for (const f of frames) {
  const t = Date.now();
  await renderStill({composition: comp, serveUrl, frame: f, inputProps, output: path.join(out, `f${String(f).padStart(4, '0')}.png`), browserExecutable: exe, chromiumOptions});
  console.log(`quadro ${f}: ${Date.now() - t} ms`);
}
