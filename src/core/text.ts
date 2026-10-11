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

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

/**
 * Converte numerais por extenso (sem acento) em digitos: "quarenta e nove" → "49". O ASR escreve numeros em digitos.
 * Como na lingua, as partes de um numero vem em ordem decrescente, ligadas por "e" (ou logo apos "mil"):
 * "cento e oitenta e nove" → 189, mas "quatro e vinte" (libras e pence) → "4 e 20" e "sessenta. Quatro" → "60 4".
 */
export function numbersToDigits(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (!(words[i] in UNITS) && words[i] !== 'mil') {
      out.push(words[i]);
      i++;
      continue;
    }
    let total = 0;
    let cur = 0;
    let last = Infinity; // valor da ultima parte somada: a proxima precisa ser menor
    let joined = true; // a palavra atual pode continuar o numero (inicio, depois de "e" ou de "mil")
    let j = i;
    while (j < words.length) {
      const w = words[j];
      if (w in UNITS && joined && UNITS[w] < last) {
        cur += UNITS[w];
        last = UNITS[w];
        joined = false;
      } else if (w === 'mil' && total === 0) {
        total = (cur || 1) * 1000;
        cur = 0;
        last = 1000;
        joined = true;
      } else if (w === 'e' && j > i && words[j - 1] !== 'e' && j + 1 < words.length && words[j + 1] in UNITS && UNITS[words[j + 1]] < last) {
        joined = true;
      } else break;
      j++;
    }
    out.push(String(total + cur));
    i = j;
  }
  return out;
}

/** Junta palavras e funde letras repetidas: a elisao da fala ("almofada aquecida" → "almofadaquecida") some. */
const fuse = (...ws: string[]) => ws.join('').replace(/(.)\1+/g, '$1');

/**
 * Taxa de erro por palavra (Levenshtein em palavras), insensivel a acentos. Diferenca so de divisao entre palavras
 * ("almofada aquecida" x "almofa daquecida", elisao natural da fala) nao conta como erro: o ASR ouviu os mesmos sons.
 */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const r = numbersToDigits(normalizeWords(stripAccents(reference)));
  const h = numbersToDigits(normalizeWords(stripAccents(hypothesis)));
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  const d: number[][] = Array.from({length: r.length + 1}, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      // Mesmas letras com outra divisao: 1↔2, 2↔1 e 2↔2 palavras.
      if (j >= 2 && fuse(r[i - 1]) === fuse(h[j - 2], h[j - 1])) best = Math.min(best, d[i - 1][j - 2]);
      if (i >= 2 && fuse(r[i - 2], r[i - 1]) === fuse(h[j - 1])) best = Math.min(best, d[i - 2][j - 1]);
      if (i >= 2 && j >= 2 && fuse(r[i - 2], r[i - 1]) === fuse(h[j - 2], h[j - 1])) best = Math.min(best, d[i - 2][j - 2]);
      d[i][j] = best;
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

/**
 * Quebra uma fala em blocos de legenda: primeiro por frase; frases longas sao divididas no menor numero de
 * blocos (ate maxChars cada, ~2 linhas) com tamanhos equilibrados, para nao sobrar fragmento curto.
 */
export function chunkCaption(text: string, maxChars = 32): string[] {
  const visible = (w: string[]) => w.join(' ').replace(/\u00ad/g, '').length;
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (visible(words) <= maxChars || words.length === 1) {
      out.push(words.join(' '));
      continue;
    }
    // Particao em k blocos contiguos minimizando o maior bloco (programacao dinamica; frases sao curtas).
    const n = words.length;
    let best: string[][] | null = null;
    for (let k = Math.ceil(visible(words) / maxChars); k <= n && !best; k++) {
      const cost: number[][] = Array.from({length: k + 1}, () => Array(n + 1).fill(Infinity));
      const cut: number[][] = Array.from({length: k + 1}, () => Array(n + 1).fill(0));
      cost[0][0] = 0;
      for (let j = 1; j <= k; j++) {
        for (let i = 1; i <= n; i++) {
          for (let p = j - 1; p < i; p++) {
            const c = Math.max(cost[j - 1][p], visible(words.slice(p, i)));
            if (c < cost[j][i]) {
              cost[j][i] = c;
              cut[j][i] = p;
            }
          }
        }
      }
      if (cost[k][n] <= maxChars) {
        const parts: string[][] = [];
        let i = n;
        for (let j = k; j >= 1; j--) {
          parts.unshift(words.slice(cut[j][i], i));
          i = cut[j][i];
        }
        best = parts;
      }
    }
    for (const part of best ?? [words]) out.push(part.join(' '));
  }
  return out;
}
