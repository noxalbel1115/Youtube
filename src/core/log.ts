// Logger minimo com redacao de segredos: qualquer valor de variavel de ambiente
// sensivel e substituido por [REDACTED] antes de ir para o console ou para o estado.

const SECRET_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
  'YT_CLIENT_SECRET',
  'YT_REFRESH_TOKEN',
  'OPENAI_API_KEY',
];

function secretValues(): string[] {
  return SECRET_ENV_KEYS.map((k) => process.env[k]).filter((v): v is string => !!v && v.length >= 8);
}

export function redact(input: string): string {
  let out = input;
  for (const v of secretValues()) out = out.split(v).join('[REDACTED]');
  // Tokens OAuth do Google e chaves no formato sk-...
  out = out.replace(/ya29\.[A-Za-z0-9_\-.]+/g, 'ya29.[REDACTED]');
  out = out.replace(/1\/\/[A-Za-z0-9_\-]{20,}/g, '1//[REDACTED]');
  out = out.replace(/sk-[A-Za-z0-9_\-]{16,}/g, 'sk-[REDACTED]');
  return out;
}

function fmt(level: string, msg: string): string {
  const ts = new Date().toISOString().slice(11, 19);
  return `[${ts}] ${level} ${redact(msg)}`;
}

export const log = {
  info: (msg: string) => console.log(fmt('INFO ', msg)),
  warn: (msg: string) => console.warn(fmt('WARN ', msg)),
  error: (msg: string) => console.error(fmt('ERROR', msg)),
  step: (msg: string) => console.log(fmt('>>>  ', msg)),
};
