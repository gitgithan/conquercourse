#!/usr/bin/env python3
"""Cover photos for ready places that have none (CC-90): one famous Wikimedia Commons picture per place, licence-checked.
Usage: python3 scripts/place_covers.py [slug ...]   (no slugs = every place without a thumb)
Writes public/assets/places/thumbs/<slug>.jpg (320x180) and the credit in thumbs/index.json. Review the contact sheet before committing."""
import io, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from PIL import Image

ROOT = 'public/assets/places'
UA = {'User-Agent': 'ConquerCourse/1.0 (educational physics game; place cover photos)'}
QUERY = {  # a famous view of the place, in plain words
  'bryant-park-new-york': 'Bryant Park New York Public Library lawn', 'place-des-vosges-paris': 'Place des Vosges Paris arcades',
  'jordaan-amsterdam': 'Jordaan Amsterdam Egelantiersgracht', 'stephansplatz-vienna': 'Stephansdom Vienna cathedral',
  'grand-place-brussels': 'Grand Place Brussels guildhalls', 'main-square-krakow': 'Main Square Krakow Cloth Hall',
  'castle-hill-budapest': 'Buda Castle Budapest Castle Hill', 'gamla-stan-stockholm': 'Stortorget Gamla Stan Stockholm',
  'temple-bar-dublin': 'Temple Bar pub Dublin', 'plaka-athens': 'Plaka Athens Acropolis neighbourhood',
  'stradun-dubrovnik': 'Stradun Dubrovnik main street', 'galata-istanbul': 'Galata Tower Istanbul skyline',
  'gastown-vancouver': 'Gastown Vancouver street historic buildings', 'zocalo-mexico-city': 'Zocalo Mexico City Metropolitan Cathedral square',
  'caminito-buenos-aires': 'Caminito La Boca Buenos Aires', 'bukchon-seoul': 'Bukchon Hanok Village Seoul',
  'senate-square-helsinki': 'Senate Square Helsinki cathedral', 'old-town-tallinn': 'Tallinn Old Town Town Hall Square',
  'bo-kaap-cape-town': 'Bo-Kaap Cape Town colourful houses', 'bryggen-bergen': 'Bryggen Bergen wharf'}
OK = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?( [0-9.]+)?)', re.I)
BAD = re.compile(r'map|logo|flag|coat of arms|panorama of|plan|diagram|poster|stamp|portrait|crowd|protest|plaque|ceiling|interior|drawing|engraving|sunset|graffiti|chairs|night|wall-painting|steam clock', re.I)

def get(url, tries=6):  # Wikimedia asks for a slow, polite client: pause and back off on 429
    for n in range(tries):
        try:
            time.sleep(2); return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or n == tries - 1: raise
            time.sleep(15 * (n + 1))

def api(**p):
    p.update(format='json', action='query')
    return json.loads(get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p)))

def best(slug, q):
    r = api(generator='search', gsrsearch=q + ' filetype:bitmap', gsrnamespace=6, gsrlimit=25, prop='imageinfo', iiprop='url|size|extmetadata|mime', iiurlwidth=640)
    for pg in sorted(r.get('query', {}).get('pages', {}).values(), key=lambda x: x.get('index', 99)):
        ii = (pg.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {}); lic = m.get('LicenseShortName', {}).get('value', '')
        w, h = ii.get('width', 0), ii.get('height', 0)
        if not ii or ii.get('mime') != 'image/jpeg' or not OK.match(lic) or BAD.search(pg['title']) or w < 1200 or not 1.3 <= w / h <= 2.0: continue
        author = re.sub(r'<[^>]+>', '', m.get('Artist', {}).get('value', 'unknown')).strip()[:80]
        return dict(title=pg['title'][5:], author=author, licence=lic, licenceUrl=m.get('LicenseUrl', {}).get('value', ''), source=ii['descriptionurl']), ii['thumburl']
    return None, None

def main():
    idx = json.load(open(f'{ROOT}/index.json')); th = json.load(open(f'{ROOT}/thumbs/index.json'))
    todo = sys.argv[1:] or [p['slug'] for p in idx if p['slug'] not in th]
    for s in todo:
        credit, url = best(s, QUERY.get(s, s.replace('-', ' ')))
        if not credit: print('NONE', s); continue
        im = Image.open(io.BytesIO(get(url))).convert('RGB')
        w, h = im.size; nh = int(w * 9 / 16)
        if nh < h: top = (h - nh) // 2; im = im.crop((0, top, w, top + nh))
        im.resize((320, 180)).save(f'{ROOT}/thumbs/{s}.jpg', quality=82, optimize=True, progressive=True)
        th[s] = credit; print('OK', s, credit['licence'], credit['title'], flush=True)
        json.dump(th, open(f'{ROOT}/thumbs/index.json', 'w'), indent=2, ensure_ascii=False); open(f'{ROOT}/thumbs/index.json', 'a').write('\n')
main()
