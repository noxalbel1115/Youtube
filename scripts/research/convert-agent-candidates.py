"""Converte a saida bruta do agente de pesquisa (formato livre) para o schema CandidatesFile.
Uso: python3 convert-agent-candidates.py entrada.json saida.json [N]
O candidato principal pode ser sobrescrito por um arquivo curado (ver --override)."""
import json, re, sys
from urllib.parse import urlparse, unquote

def lic(s):
    s = s.lower()
    if 'migration=relicense' in s or ('gfdl' in s and 'by-sa' in s): return 'by-sa', '3.0'
    if 'cc0' in s: return 'cc0', None
    if 'by-sa' in s: return 'by-sa', None
    if 'by-nc' in s or 'by-nd' in s: return 'by-nc', None
    if 'cc by' in s: return 'by', None
    if 'public domain' in s: return 'pdm', None
    return 'unknown', None

def kind_of(url):
    h = urlparse(url).netloc
    if 'amazon' in h or 'otto' in h or 'mercadolivre' in h or 'snips' in h: return 'retailer'
    if 'wikipedia' in h or 'wikimedia' in h or 'dwds' in h: return 'encyclopedia'
    if 'kk.org' in h: return 'press'
    return 'manufacturer'

def convert(c):
    sources, ids = [], {}
    for i, s in enumerate(c['sources']):
        sid = f"s{i+1}"; ids[s['url']] = sid
        sources.append({"id": sid, "url": s['url'], "title": s.get('title') or urlparse(s['url']).path.strip('/')[:80] or urlparse(s['url']).netloc,
                        "publisher": urlparse(s['url']).netloc.replace('www.', ''), "kind": kind_of(s['url']),
                        "accessedAt": s.get('consulted', '2026-10-10')[:10], "confirms": s['confirms'][:400]})
    price = None
    prices = c['price'] if isinstance(c['price'], list) else []
    if prices:
        p = prices[0]
        if p['url'] not in ids:
            sid = f"s{len(sources)+1}"; ids[p['url']] = sid
            sources.append({"id": sid, "url": p['url'], "title": "Pagina com preco", "publisher": urlparse(p['url']).netloc.replace('www.', ''),
                            "kind": kind_of(p['url']), "accessedAt": p.get('consulted', '2026-10-10')[:10], "confirms": p.get('note', 'preco')[:400]})
        price = {"amount": p['value'], "currency": p['currency'], "sourceId": ids[p['url']], "observedAt": p.get('consulted', '2026-10-10')[:10], "note": p.get('note', '')[:300]}
    media = []
    for j, m in enumerate(c['media']):
        code, ver = lic(m['license'])
        land = m['landing_url']
        prov = 'wikimedia' if 'wikimedia.org' in land else ('flickr' if 'flickr.com' in land else 'other')
        ref = 'File:' + unquote(land.split('File:')[1]) if prov == 'wikimedia' and 'File:' in land else None
        media.append({"id": f"m{j+1}", "kind": "image", "title": (m.get('shows') or 'imagem')[:120], "creator": m['creator'], "provider": prov,
                      "landingUrl": land, "fileUrl": m['file_url'], "license": code, "licenseVersion": ver or m.get('license_version'),
                      "showsExactProduct": str(m.get('match', '')).startswith('exact'), "description": (m.get('shows') or '')[:400],
                      **({"providerRef": ref} if ref else {})})
    sc = c['scores']
    return {"slug": c['id'], "name": c['name'][:120], "brand": c['manufacturer_brand'][:120], "description": c['what_it_does'],
            "legitimateUse": c['legitimate_use_audience'], "punchingDownRisk": c['punching_down_risk'] if isinstance(c['punching_down_risk'], str) else json.dumps(c['punching_down_risk'], ensure_ascii=False),
            "sources": sources, "facts": [{"id": "f1", "text": c['what_it_does'], "sourceIds": [sources[0]['id']]}], "price": price, "media": media,
            "scores": {"contrast": sc['contrast_problem_solution'], "story": sc['story_potential'], "visual": sc['visual_clarity'], "media": sc['media_availability'], "reliability": sc['info_reliability']},
            "risks": c.get('risks', []), "comedyAngle": c.get('reality_interrupts_idea', '')}

src, dst = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 10
override = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else None
raw = sorted(json.load(open(src)), key=lambda c: c['rank'])[:n]
cands = [convert(c) for c in raw]
if override:
    cands = [override if c['slug'] == override['slug'] else c for c in cands]
json.dump({"researchedAt": "2026-10-10", "method": "Agente de pesquisa (WebSearch/WebFetch/Firecrawl, APIs Openverse e Wikimedia) + verificacao manual do candidato escolhido na pagina do fabricante, Wikipedia (de) e DWDS.", "candidates": cands},
          open(dst, 'w'), ensure_ascii=False, indent=1)
print(len(cands), 'candidatos')
