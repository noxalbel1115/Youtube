// Idioma do episodio (campo "language" do roteiro): nome e lema do canal, etiqueta do vendedor, vozes, idioma da
// transcricao e textos fixos da tela e da descricao. pt-BR vem de config.channel e providers.tts.voices (como sempre);
// os demais idiomas, de config.locales.<idioma>.
import type {Config} from './config.js';

export const LANGUAGES = ['pt-BR', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Locale {
  language: Language;
  /** Codigo para o Whisper (faster-whisper). */
  asr: string;
  channel: {name: string; shortName: string; motto: string; salesman: {name: string; title: string}};
  voices: Config['providers']['tts']['voices'];
  ui: {protocol: string; factsheet: string; dept: string};
  text: {
    about: string;
    realProduct: (name: string, brand: string) => string;
    notAd: string;
    checked: (date: string) => string;
    price: (currency: string, amount: string, date: string, publisher: string) => string;
    sources: string;
    accessed: (date: string) => string;
    imageCredits: string;
    production: string;
    graphics: string;
    syntheticVoice: string;
    captionsName: string;
  };
}

const PT_TEXT: Locale['text'] = {
  about: '— Sobre este vídeo —',
  realProduct: (name, brand) => `O vendedor e a colega são personagens fictícios. O produto é real: ${name}. ${brand}.`,
  notAd: 'Não é publicidade: não há patrocínio nem relação com fabricantes ou lojas citados. As fotos têm licença livre e são creditadas abaixo.',
  checked: (date) => `As informações factuais sobre o produto foram conferidas nas fontes abaixo em ${date}.`,
  price: (currency, amount, date, publisher) => `Preço consultado: ${currency} ${amount.replace('.', ',')} em ${date} (${publisher}). Preços mudam.`,
  sources: '— Fontes —',
  accessed: (date) => `consultado em ${date}`,
  imageCredits: '— Créditos de imagem —',
  production: '— Produção —',
  graphics: 'Efeitos sonoros e grafismos produzidos pelo canal.',
  syntheticVoice: 'Voz sintética',
  captionsName: 'DND pt-BR',
};

const EN_TEXT: Locale['text'] = {
  about: '— About this video —',
  realProduct: (name, brand) => `The salesman and his colleague are fictional characters. The product is real: ${name}. ${brand}.`,
  notAd: 'Not an advertisement: no sponsorship and no relationship with any manufacturer or shop mentioned. Photos are freely licensed and credited below.',
  checked: (date) => `Factual information about the product was checked against the sources below on ${date}.`,
  price: (currency, amount, date, publisher) => `Price checked: ${currency} ${amount} on ${date} (${publisher}). Prices change.`,
  sources: '— Sources —',
  accessed: (date) => `accessed ${date}`,
  imageCredits: '— Image credits —',
  production: '— Production —',
  graphics: 'Sound effects and graphics made by the channel.',
  syntheticVoice: 'Synthetic voice',
  captionsName: 'DUN en',
};

export function localeFor(cfg: Config, language: Language = 'pt-BR'): Locale {
  if (language === 'pt-BR') {
    const {name, shortName, motto, salesman} = cfg.channel;
    return {language, asr: 'pt', channel: {name, shortName, motto, salesman}, voices: cfg.providers.tts.voices, ui: {protocol: 'PROTOCOLO', factsheet: 'FICHA TÉCNICA', dept: 'DEPTO. 001'}, text: PT_TEXT};
  }
  const l = cfg.locales[language];
  if (!l) throw new Error(`Idioma ${language} sem configuracao em config/channel.json → locales.${language}`);
  return {language, asr: 'en', channel: {name: l.name, shortName: l.shortName, motto: l.motto, salesman: l.salesman}, voices: l.voices, ui: {protocol: 'PROTOCOL', factsheet: 'SPEC SHEET', dept: 'DEPT. 001'}, text: EN_TEXT};
}
