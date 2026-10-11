// Idioma do episodio: textos fixos do pipeline (o resto do texto visivel vem do roteiro), canal e vozes por idioma.
import type {Config} from './config.js';

export const LOCALES = ['pt-BR', 'en-US'] as const;
export type Locale = (typeof LOCALES)[number];

export interface LocaleStrings {
  /** Codigo de idioma do Whisper. */
  asrLanguage: string;
  caseLabel: (n: string) => string;
  sealLabel: (n: string) => string;
  factsheetLabel: string;
  by: string;
  modifications: string;
  date: (iso: string) => string;
  money: (amount: number, currency: string) => string;
  about: string;
  fiction: (productName: string, productBrand: string) => string;
  notAd: string;
  checked: (date: string) => string;
  price: (money: string, date: string, publisher: string) => string;
  sources: string;
  accessed: (date: string) => string;
  imageCredits: string;
  production: string;
  producedByChannel: string;
  voicePrefix: string;
  voiceLabels: Record<string, string>;
  studioLanguage: string;
  studioCategory: string;
}

const isoParts = (iso: string) => iso.slice(0, 10).split('-');

export const STRINGS: Record<Locale, LocaleStrings> = {
  'pt-BR': {
    asrLanguage: 'pt',
    caseLabel: (n) => `PROTOCOLO ${n}`,
    sealLabel: (n) => `DEPTO. ${n}`,
    factsheetLabel: 'FICHA TÉCNICA',
    by: 'por',
    modifications: 'Modificações: recorte e enquadramento vertical, redimensionamento, movimento de câmera, sobreposição de textos e gráficos.',
    date: (iso) => {
      const [y, m, d] = isoParts(iso);
      return `${d}/${m}/${y}`;
    },
    money: (amount, currency) => `${currency} ${amount.toFixed(2).replace('.', ',')}`,
    about: 'Sobre este vídeo',
    fiction: (name, brand) => `O vendedor e a colega são personagens fictícios. O produto é real: ${name}. ${brand}.`,
    notAd: 'Não é publicidade: não há patrocínio nem relação com fabricantes ou lojas citados. As fotos têm licença livre e são creditadas abaixo.',
    checked: (d) => `As informações factuais sobre o produto foram conferidas nas fontes abaixo em ${d}.`,
    price: (money, d, pub) => `Preço consultado: ${money} em ${d} (${pub}). Preços mudam.`,
    sources: 'Fontes',
    accessed: (d) => `consultado em ${d}`,
    imageCredits: 'Créditos de imagem',
    production: 'Produção',
    producedByChannel: 'Efeitos sonoros e grafismos produzidos pelo canal.',
    voicePrefix: 'Voz sintética',
    voiceLabels: {kokoro: 'Kokoro-82M (licença Apache-2.0, execução local)', piper: 'Piper (uso interno)'},
    studioLanguage: 'Português (Brasil)',
    studioCategory: 'Comédia',
  },
  'en-US': {
    asrLanguage: 'en',
    caseLabel: (n) => `PROTOCOL ${n}`,
    sealLabel: (n) => `DEPT. ${n}`,
    factsheetLabel: 'SPEC SHEET',
    by: 'by',
    modifications: 'Modifications: vertical crop and framing, resizing, camera movement, text and graphics overlays.',
    date: (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'}),
    money: (amount, currency) => `${currency} ${amount.toFixed(2)}`,
    about: 'About this video',
    fiction: (name, brand) => `The salesman and his colleague are fictional characters. The product is real: ${name}. ${brand}.`,
    notAd: 'Not an ad: no sponsorship and no relationship with the manufacturers or stores mentioned. The photos are freely licensed and credited below.',
    checked: (d) => `Product facts were checked against the sources below on ${d}.`,
    price: (money, d, pub) => `Price checked: ${money} on ${d} (${pub}). Prices change.`,
    sources: 'Sources',
    accessed: (d) => `accessed ${d}`,
    imageCredits: 'Image credits',
    production: 'Production',
    producedByChannel: 'Sound effects and graphics made by the channel.',
    voicePrefix: 'Synthetic voice',
    voiceLabels: {kokoro: 'Kokoro-82M (Apache-2.0 license, run locally)', piper: 'Piper (internal use)'},
    studioLanguage: 'English (United States)',
    studioCategory: 'Comedy',
  },
};

export function isLocale(s: unknown): s is Locale {
  return typeof s === 'string' && (LOCALES as readonly string[]).includes(s);
}

/** Numero do episodio a partir do id (ep001-... → "001"). */
export function episodeNumber(id: string): string {
  return /^ep(\d+)/.exec(id)?.[1] ?? '000';
}

/** Canal e vozes do idioma: o bloco base de config/channel.json vale para pt-BR; config.locales sobrepoe os demais. */
export function localized(cfg: Config, locale: Locale) {
  const o = cfg.locales[locale];
  return {
    channel: o?.channel ?? cfg.channel,
    voices: o?.voices ?? cfg.providers.tts.voices,
    strings: STRINGS[locale],
  };
}
