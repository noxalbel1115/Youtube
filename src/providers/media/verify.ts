// Verificacao de licenca diretamente na origem, antes de qualquer download.
// Wikimedia Commons: le o wikitext da pagina do arquivo (api.wikimedia.org) e extrai os modelos de licenca.
// Openverse: le o registro do item na API publica (que espelha a licenca declarada no Flickr/Commons).
import type {LicenseCode, MediaCandidate} from '../../schemas.js';

const UA = 'DNN-pipeline/0.1 (+https://github.com/noxalbel1115/Youtube)';

export interface VerifyResult {
  ok: boolean;
  license: LicenseCode;
  licenseVersion?: string;
  creator?: string;
  fileUrl?: string;
  width?: number;
  height?: number;
  method: string;
  detail: string;
}

/** GET JSON com backoff exponencial em 429/5xx (Wikimedia limita trafego anonimo por IP). */
async function getJson(url: string, attempts = 5): Promise<any> {
  let wait = 2000;
  for (let i = 1; ; i++) {
    const res = await fetch(url, {headers: {'user-agent': UA, accept: 'application/json'}, signal: AbortSignal.timeout(30000)});
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || i >= attempts) throw new Error(`HTTP ${res.status} em ${url}`);
    const ra = Number(res.headers.get('retry-after'));
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait));
    wait *= 2;
  }
}

export function parseCommonsLicense(wikitext: string): {license: LicenseCode; version?: string; all: string[]} {
  const found: string[] = [];
  for (const m of wikitext.matchAll(/\{\{\s*(?:self\s*\|)?\s*([A-Za-z0-9\-. ]+?)\s*(?:\||\}\})/g)) {
    const t = m[1].toLowerCase();
    if (/^(cc-|pd-|gfdl|fal|cc0)/.test(t)) found.push(t);
  }
  // Modelos dentro de {{self|cc-by-sa-4.0|GFDL}} tambem aparecem como parametros
  for (const m of wikitext.matchAll(/\{\{\s*self\s*\|([^}]*)\}\}/gi)) {
    for (const part of m[1].split('|')) {
      const t = part.trim().toLowerCase();
      if (/^(cc-|pd-|gfdl|fal|cc0)/.test(t)) found.push(t);
    }
  }
  const uniq = [...new Set(found)];
  // Licenca mais permissiva entre as oferecidas (multilicenca permite escolher)
  const pref: LicenseCode[] = ['cc0', 'pdm', 'by', 'by-sa'];
  const mapped = uniq.map((t): {license: LicenseCode; version?: string} => {
    if (t === 'cc-zero' || t === 'cc0') return {license: 'cc0'};
    if (t.startsWith('pd-')) return {license: 'pdm'};
    let m = t.match(/^cc-by-sa-(\d\.\d)/);
    if (m) return {license: 'by-sa', version: m[1]};
    m = t.match(/^cc-by-(\d\.\d)/);
    if (m) return {license: 'by', version: m[1]};
    if (t.startsWith('cc-by-nc') || t.startsWith('cc-by-nd')) return {license: 'by-nc'};
    return {license: 'unknown'};
  });
  for (const p of pref) {
    const hit = mapped.find((x) => x.license === p);
    if (hit) return {...hit, all: uniq};
  }
  return {license: mapped[0]?.license ?? 'unknown', all: uniq};
}

export async function verifyWikimedia(m: MediaCandidate): Promise<VerifyResult> {
  const title = m.providerRef ?? decodeURIComponent(new URL(m.landingUrl).pathname.split('/').pop() ?? '');
  const t = encodeURIComponent(title.replace(/ /g, '_'));
  const page = await getJson(`https://api.wikimedia.org/core/v1/commons/page/${t}`);
  const lic = parseCommonsLicense(page.source ?? '');
  const file = await getJson(`https://api.wikimedia.org/core/v1/commons/file/${t}`);
  const author = (page.source as string).match(/\|\s*[Aa]uthor\s*=\s*([^\n|]+)/)?.[1]?.trim();
  return {
    ok: lic.license !== 'unknown',
    license: lic.license,
    licenseVersion: lic.version,
    creator: author,
    fileUrl: file.original?.url,
    width: file.original?.width,
    height: file.original?.height,
    method: 'wikimedia-wikitext',
    detail: `modelos de licenca encontrados: ${lic.all.join(', ') || 'nenhum'}`,
  };
}

export async function verifyOpenverse(m: MediaCandidate): Promise<VerifyResult> {
  if (!m.providerRef) throw new Error(`${m.id}: providerRef (id Openverse) ausente`);
  const kind = m.kind === 'audio' ? 'audio' : 'images';
  const r = await getJson(`https://api.openverse.org/v1/${kind}/${m.providerRef}/`);
  return {
    ok: true,
    license: r.license as LicenseCode,
    licenseVersion: r.license_version,
    creator: r.creator,
    fileUrl: r.url,
    width: r.width,
    height: r.height,
    method: `openverse-api (fonte: ${r.source}, pagina: ${r.foreign_landing_url})`,
    detail: `licenca declarada na origem segundo Openverse: ${r.license} ${r.license_version}; atribuicao: ${r.attribution ?? ''}`.slice(0, 600),
  };
}

export async function verifyMedia(m: MediaCandidate): Promise<VerifyResult> {
  if (m.provider === 'wikimedia') return verifyWikimedia(m);
  if (m.provider === 'openverse' || m.provider === 'flickr') return verifyOpenverse(m);
  if (m.provider === 'own' || m.provider === 'generated') {
    return {ok: true, license: m.license, method: 'proprio', detail: 'material produzido pelo projeto'};
  }
  return {ok: false, license: 'unknown', method: 'nenhum', detail: `provedor ${m.provider} sem verificacao automatica: exige permissao documentada`};
}

export function licenseUrl(code: LicenseCode, version?: string): string | undefined {
  const v = version ?? '4.0';
  switch (code) {
    case 'by':
      return `https://creativecommons.org/licenses/by/${v}/`;
    case 'by-sa':
      return `https://creativecommons.org/licenses/by-sa/${v}/`;
    case 'cc0':
      return 'https://creativecommons.org/publicdomain/zero/1.0/';
    case 'pdm':
      return 'https://creativecommons.org/publicdomain/mark/1.0/';
    default:
      return undefined;
  }
}

export function licenseLabel(code: LicenseCode, version?: string): string {
  switch (code) {
    case 'by':
      return `CC BY ${version ?? ''}`.trim();
    case 'by-sa':
      return `CC BY-SA ${version ?? ''}`.trim();
    case 'cc0':
      return 'CC0 1.0';
    case 'pdm':
      return 'Dominio publico';
    default:
      return code;
  }
}

export function conditionsFor(code: LicenseCode, version?: string): string[] {
  const c: string[] = [];
  if (code === 'by' || code === 'by-sa') c.push('Atribuicao obrigatoria: autor, titulo/fonte, licenca com link e indicacao de modificacoes.');
  if (code === 'by-sa') {
    c.push(
      'Compartilha-Igual: se o video for considerado obra adaptada, as contribuicoes adaptadas devem ser licenciadas sob BY-SA (ou compativel). O YouTube so oferece CC BY como opcao de licenca; revisar antes de publicar.',
    );
  }
  if (code === 'pdm' || code === 'cc0') c.push('Sem exigencia de atribuicao; creditar por boa pratica.');
  if (version && Number(version) < 4 && (code === 'by' || code === 'by-sa')) c.push(`Versao ${version}: a licenca nao cobre direitos sui generis de banco de dados; irrelevante para fotos.`);
  c.push('Licenca de direito autoral nao autoriza uso de marca: nao sugerir endosso do fabricante.');
  return c;
}
