import type {Locale} from './locale.js';

/** Normaliza para comparacao: minusculas, sem pontuacao, espacos simples. Mantem acentos. */
export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/’/g, "'")
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

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Ingles: "twenty eight" → "28", "one hundred and five" → "105" (o hifen ja virou espaco em normalizeWords). */
function englishNumbersToDigits(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (!(words[i] in EN_UNITS)) {
      out.push(words[i]);
      i++;
      continue;
    }
    let total = 0;
    let cur = 0;
    let j = i;
    while (j < words.length) {
      const w = words[j];
      if (w in EN_UNITS) cur += EN_UNITS[w];
      else if (w === 'hundred') cur = (cur || 1) * 100;
      else if (w === 'thousand') {
        total += (cur || 1) * 1000;
        cur = 0;
      } else if (w === 'and' && j + 1 < words.length && words[j + 1] in EN_UNITS && (cur >= 100 || total > 0)) {
        j++;
        continue;
      } else break;
      j++;
    }
    out.push(String(total + cur));
    i = j;
  }
  return out;
}

/** Converte numerais por extenso (sem acento) em digitos: "quarenta e nove" → "49". O ASR escreve numeros em digitos. */
export function numbersToDigits(words: string[], locale: Locale = 'pt-BR'): string[] {
  if (locale === 'en-US') return englishNumbersToDigits(words);
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
    let j = i;
    while (j < words.length) {
      const w = words[j];
      if (w in UNITS) cur += UNITS[w];
      else if (w === 'mil') {
        total += (cur || 1) * 1000;
        cur = 0;
      } else if (w === 'e' && j + 1 < words.length && (words[j + 1] in UNITS || words[j + 1] === 'mil')) {
        j++;
        continue;
      } else break;
      j++;
    }
    out.push(String(total + cur));
    i = j;
  }
  return out;
}

/** Taxa de erro por palavra (Levenshtein em palavras), insensivel a acentos. */
export function wordErrorRate(reference: string, hypothesis: string, locale: Locale = 'pt-BR'): number {
  const r = numbersToDigits(normalizeWords(stripAccents(reference)), locale);
  const h = numbersToDigits(normalizeWords(stripAccents(hypothesis)), locale);
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
