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

/** Converte numerais por extenso (sem acento) em digitos: "quarenta e nove" → "49". O ASR escreve numeros em digitos. */
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
export function wordErrorRate(reference: string, hypothesis: string): number {
  const r = numbersToDigits(normalizeWords(stripAccents(reference)));
  const h = numbersToDigits(normalizeWords(stripAccents(hypothesis)));
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

/** Quebra uma fala em blocos de legenda curtos (ate ~2 linhas), preferindo quebrar apos pontuacao e sem deixar palavra orfa. */
export function chunkCaption(text: string, maxChars = 28, maxWords = 6): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    const candidate = [...cur, w].join(' ');
    if (cur.length > 0 && (candidate.length > maxChars || cur.length >= maxWords)) {
      chunks.push(cur);
      cur = [w];
    } else cur.push(w);
    if (/[.!?…:]$/.test(w) && cur.join(' ').length >= 10) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  // Palavra orfa (bloco de 1 palavra curta) volta para o bloco anterior se couber com folga.
  for (let i = chunks.length - 1; i > 0; i--) {
    const c = chunks[i];
    const prev = chunks[i - 1];
    const prevEndsSentence = /[.!?…:]$/.test(prev[prev.length - 1]);
    if (c.length === 1 && c[0].length <= 8 && !prevEndsSentence && [...prev, ...c].join(' ').length <= maxChars + 8) {
      chunks[i - 1] = [...prev, ...c];
      chunks.splice(i, 1);
    }
  }
  return chunks.map((c) => c.join(' '));
}
