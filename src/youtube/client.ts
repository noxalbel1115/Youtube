// Cliente minimo da YouTube Data API v3. O upload usa o protocolo resumivel diretamente
// (o pacote googleapis so faz upload multipart e nao retoma), o que permite:
//  - persistir a URI da sessao antes de enviar bytes;
//  - consultar a sessao apos queda/timeout: se o upload ja terminou, a API devolve o video (sem duplicar);
//  - retomar do byte certo.
import fs from 'node:fs';

const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  selfDeclaredMadeForKids: boolean;
  containsSyntheticMedia: boolean;
}

export type SessionState = {state: 'complete'; video: any} | {state: 'incomplete'; nextByte: number} | {state: 'expired'};

async function api(token: string, method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {authorization: `Bearer ${token}`, ...(body ? {'content-type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`YouTube API ${method} ${url.split('?')[0]} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

export function videoResource(m: VideoMetadata) {
  return {
    snippet: {title: m.title, description: m.description, tags: m.tags, categoryId: m.categoryId, defaultLanguage: m.defaultLanguage},
    status: {
      // Privacidade SEMPRE explicita: o padrao da API, se omitida, e "public".
      privacyStatus: m.privacyStatus,
      ...(m.publishAt ? {publishAt: m.publishAt} : {}),
      selfDeclaredMadeForKids: m.selfDeclaredMadeForKids,
      containsSyntheticMedia: m.containsSyntheticMedia,
      embeddable: true,
      license: 'youtube',
    },
  };
}

export async function createUploadSession(token: string, m: VideoMetadata, size: number): Promise<string> {
  const res = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(size),
      'x-upload-content-type': 'video/mp4',
    },
    body: JSON.stringify(videoResource(m)),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`criar sessao de upload → HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const loc = res.headers.get('location');
  if (!loc) throw new Error('sessao de upload sem cabecalho Location');
  return loc;
}

/** Consulta o estado da sessao (PUT vazio com Content-Range: bytes * / total). */
export async function querySession(token: string, uri: string, size: number): Promise<SessionState> {
  const res = await fetch(uri, {
    method: 'PUT',
    headers: {authorization: `Bearer ${token}`, 'content-range': `bytes */${size}`, 'content-length': '0'},
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 200 || res.status === 201) return {state: 'complete', video: await res.json()};
  if (res.status === 308) {
    const range = res.headers.get('range');
    return {state: 'incomplete', nextByte: range ? Number(range.split('-')[1]) + 1 : 0};
  }
  if (res.status === 404 || res.status === 410) return {state: 'expired'};
  throw new Error(`consultar sessao → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Envia o arquivo a partir de um byte. Devolve o recurso de video quando a API conclui (200/201). */
export async function uploadFrom(token: string, uri: string, file: string, start: number, size: number): Promise<any> {
  const stream = fs.createReadStream(file, {start});
  const res = await fetch(uri, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-length': String(size - start),
      'content-type': 'video/mp4',
      ...(start > 0 ? {'content-range': `bytes ${start}-${size - 1}/${size}`} : {}),
    },
    body: stream as any,
    // @ts-expect-error: necessario no Node para corpo em stream
    duplex: 'half',
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  if (res.status === 200 || res.status === 201) return res.json();
  throw new Error(`upload → HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

/** Procura, entre os uploads do canal, um video cuja descricao contenha o marcador de idempotencia. */
export async function findByMarker(token: string, marker: string, maxPages = 4): Promise<{videoId: string; privacyStatus?: string} | null> {
  const ch = await api(token, 'GET', `${API}/channels?part=contentDetails&mine=true`);
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('playlist de uploads do canal nao encontrada');
  let pageToken = '';
  for (let i = 0; i < maxPages; i++) {
    const r = await api(token, 'GET', `${API}/playlistItems?part=snippet,status&maxResults=50&playlistId=${uploads}${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const it of r.items ?? []) {
      if (typeof it.snippet?.description === 'string' && it.snippet.description.includes(marker)) {
        return {videoId: it.snippet.resourceId.videoId, privacyStatus: it.status?.privacyStatus};
      }
    }
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return null;
}

export async function getVideo(token: string, id: string): Promise<any> {
  const r = await api(token, 'GET', `${API}/videos?part=status,processingDetails,snippet&id=${id}`);
  return r.items?.[0] ?? null;
}

export async function listCaptions(token: string, videoId: string): Promise<any[]> {
  const r = await api(token, 'GET', `${API}/captions?part=snippet&videoId=${videoId}`);
  return r.items ?? [];
}

export async function insertCaptions(token: string, videoId: string, srtFile: string, name: string): Promise<string> {
  const boundary = `dnn${Date.now()}`;
  const meta = JSON.stringify({snippet: {videoId, language: 'pt-BR', name, isDraft: false}});
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`),
    fs.readFileSync(srtFile),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}`},
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`captions.insert → HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return (await res.json()).id;
}

export async function setThumbnail(token: string, videoId: string, png: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'image/png'},
    body: fs.readFileSync(png),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`thumbnails.set → HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
}

/** Custos de cota documentados (unidades), usados como ESTIMATIVA no estado do episodio. */
export const QUOTA = {insert: 1, channelsList: 1, playlistItemsList: 1, videosList: 1, captionsList: 50, captionsInsert: 400, thumbnailsSet: 50};
