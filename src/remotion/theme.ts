import {loadFont} from '@remotion/fonts';
import sans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2';
import sans400i from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2';
import sans500 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2';
import sans600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2';
import sans700 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2';
import mono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2';
import mono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2';

// Identidade: papel timbrado de reparticao, tinta azul-marinho, carimbo vermelho usado com parcimonia.
export const C = {
  paper: '#ECE8DF',
  paperDark: '#DFD9CC',
  ink: '#1C2333',
  inkSoft: '#3C4456',
  muted: '#6E6A60',
  rule: '#C4BDAE',
  stamp: '#A63A2B',
  white: '#FFFFFF',
};

export const SANS = 'IBM Plex Sans';
export const MONO = 'IBM Plex Mono';

let loaded = false;
export function loadFonts(): void {
  if (loaded) return;
  loaded = true;
  const faces: Array<[string, string, string, string]> = [
    [SANS, sans400, '400', 'normal'],
    [SANS, sans400i, '400', 'italic'],
    [SANS, sans500, '500', 'normal'],
    [SANS, sans600, '600', 'normal'],
    [SANS, sans700, '700', 'normal'],
    [MONO, mono400, '400', 'normal'],
    [MONO, mono500, '500', 'normal'],
  ];
  for (const [family, url, weight, style] of faces) loadFont({family, url, weight, style});
}

/**
 * Zona segura dos Shorts (1080x1920): a interface do YouTube cobre o topo (~200 px),
 * a base (~420 px: titulo, canal, trilha) e a coluna direita (~150 px: botoes).
 */
export const SAFE = {top: 220, bottom: 1500, left: 64, right: 930};
