// Autorizacao OAuth 2.0 (app instalado) para o canal. Fluxo oficial com redirecionamento
// loopback (127.0.0.1) e PKCE; o metodo copiar/colar (OOB) foi descontinuado pelo Google.
// O refresh token fica FORA do repositorio: arquivo com permissao 600 ou variavel YT_REFRESH_TOKEN.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {google} from 'googleapis';
import type {Config} from '../core/config.js';
import {expandHome} from '../core/paths.js';
import {log} from '../core/log.js';
import {BlockedError} from '../stages/types.js';

export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  // captions.insert exige youtube.force-ssl (youtube.upload nao basta); tambem cobre leitura do canal.
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

function clientCreds(): {clientId: string; clientSecret: string} {
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new BlockedError('Credenciais OAuth do YouTube ausentes: defina YT_CLIENT_ID e YT_CLIENT_SECRET (cliente OAuth tipo "App para computador" no Google Cloud).');
  }
  return {clientId, clientSecret};
}

export function oauthClient(cfg: Config) {
  const {clientId, clientSecret} = clientCreds();
  const client = new google.auth.OAuth2({clientId, clientSecret});
  let refresh = process.env.YT_REFRESH_TOKEN;
  const tokenFile = expandHome(cfg.youtube.tokenFile);
  if (!refresh && fs.existsSync(tokenFile)) refresh = JSON.parse(fs.readFileSync(tokenFile, 'utf8')).refresh_token;
  if (!refresh) throw new BlockedError(`Canal nao autorizado: rode "npm run dnn -- youtube:auth" numa maquina com navegador (gera ${cfg.youtube.tokenFile}) ou defina YT_REFRESH_TOKEN.`);
  client.setCredentials({refresh_token: refresh});
  // Se o Google rotacionar o refresh token, persiste o novo (somente no arquivo local).
  client.on('tokens', (t) => {
    if (t.refresh_token && !process.env.YT_REFRESH_TOKEN) saveToken(tokenFile, t.refresh_token);
  });
  return client;
}

function saveToken(file: string, refreshToken: string): void {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  fs.writeFileSync(file, JSON.stringify({refresh_token: refreshToken, savedAt: new Date().toISOString()}), {mode: 0o600});
  fs.chmodSync(file, 0o600);
}

export async function accessToken(cfg: Config): Promise<string> {
  const client = oauthClient(cfg);
  const {token} = await client.getAccessToken();
  if (!token) throw new Error('Nao foi possivel obter access token do Google');
  return token;
}

/** Fluxo interativo: abre servidor local, imprime a URL de consentimento e grava o refresh token. */
export async function authorizeInteractive(cfg: Config): Promise<void> {
  const {clientId, clientSecret} = clientCreds();
  const server = http.createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as {port: number}).port;
  const redirectUri = `http://127.0.0.1:${port}`;
  const client = new google.auth.OAuth2({clientId, clientSecret, redirectUri});
  const {codeVerifier, codeChallenge} = await client.generateCodeVerifierAsync();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    code_challenge_method: 'S256' as any,
    code_challenge: codeChallenge,
  });
  log.info(`Abra no navegador e autorize o canal:\n\n${url}\n`);
  const code = await new Promise<string>((resolve, reject) => {
    server.on('request', (req, res) => {
      const u = new URL(req.url ?? '/', redirectUri);
      const c = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.end(c ? 'Autorizado. Pode fechar esta aba.' : `Falhou: ${err}`);
      if (c) resolve(c);
      else if (err) reject(new Error(err));
    });
  });
  server.close();
  const {tokens} = await client.getToken({code, codeVerifier});
  if (!tokens.refresh_token) throw new Error('Google nao devolveu refresh token (revogue o acesso anterior e tente de novo).');
  const file = expandHome(cfg.youtube.tokenFile);
  saveToken(file, tokens.refresh_token);
  log.info(`Refresh token salvo em ${file} (permissao 600). Nao o copie para o repositorio.`);
  log.warn('Se o app OAuth estiver em modo "Teste", o refresh token expira em 7 dias. Para execucao agendada, publique o app ("Em producao").');
}
