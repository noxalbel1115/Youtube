import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EPISODES_DIR = process.env.DNN_EPISODES_DIR ?? path.join(ROOT, 'episodes');
export const DATA_DIR = process.env.DNN_DATA_DIR ?? path.join(ROOT, 'data');
export const MODELS_DIR = path.join(ROOT, 'models');
export const PYTHON_BIN = process.env.DNN_PYTHON ?? path.join(ROOT, '.venv', 'bin', 'python');

export function episodeDir(id: string): string {
  if (!/^ep\d{3}-[a-z0-9-]+$/.test(id)) throw new Error(`ID de episodio invalido: ${id}`);
  return path.join(EPISODES_DIR, id);
}

/** Caminhos gerados dentro de um episodio. Tudo em build/ e ignorado pelo git. */
export function epPaths(id: string) {
  const dir = episodeDir(id);
  const build = path.join(dir, 'build');
  return {
    dir,
    state: path.join(dir, 'state.json'),
    candidates: path.join(dir, 'research', 'candidates.json'),
    selection: path.join(dir, 'selection.json'),
    product: path.join(dir, 'product.json'),
    mediaRegistry: path.join(dir, 'media.json'),
    script: path.join(dir, 'script.json'),
    scriptHistory: path.join(dir, 'script-history'),
    build,
    assets: path.join(build, 'public'),
    lines: path.join(build, 'public', 'audio'),
    voice: path.join(build, 'voice.json'),
    timeline: path.join(build, 'timeline.json'),
    renderRaw: path.join(build, 'render-raw.mp4'),
    render: path.join(build, 'episode.mp4'),
    verifyDir: path.join(build, 'verify'),
    verifyReport: path.join(dir, 'verify-report.json'),
    packageDir: path.join(dir, 'package'),
    thumbnail: path.join(build, 'thumbnail.png'),
  };
}

export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

export function rel(p: string): string {
  return path.relative(ROOT, p);
}
