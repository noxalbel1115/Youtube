/** Normaliza para comparacao: minusculas, sem pontuacao, espacos simples. Mantem acentos. */
export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[“”"«»()\[\]{}…,.;:!?¿¡–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Taxa de erro por palavra (Levenshtein em palavras), insensivel a acentos. */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const r = normalizeWords(stripAccents(reference));
  const h = normalizeWords(stripAccents(hypothesis));
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  const d: number[][] = Array.from({length: r.length + 1}, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[r.length][h.length] / r.length;
}

/** Aplica o dicionario de pronuncia (grafia para a voz) palavra a palavra, preservando o resto. */
export function applyPronunciations(text: string, dict: Record<string, string>): string {
  let out = text;
  for (const [word, say] of Object.entries(dict)) {
    const re = new RegExp(`(?<![\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
    out = out.replace(re, say);
  }
  return out;
}

/** Quebra uma fala em blocos de legenda curtos (max palavras / caracteres), sem separar no meio de expressoes curtas. */
export function chunkCaption(text: string, maxChars = 26, maxWords = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    const candidate = [...cur, w].join(' ');
    if (cur.length > 0 && (candidate.length > maxChars || cur.length >= maxWords)) {
      chunks.push(cur.join(' '));
      cur = [w];
    } else cur.push(w);
    // Quebra preferencial apos pontuacao forte
    if (/[.!?…:]$/.test(w) && cur.join(' ').length >= 8) {
      chunks.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks;
}
