import json, sys, time, urllib.request, urllib.parse, os, re
UA = {'User-Agent': 'ConquerCourseSafetyTest/1.0 (hackathon research; noreply@users.noreply.github.com)'}
API = 'https://commons.wikimedia.org/w/api.php'
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
def get(url, binary=False, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                d = r.read(); return d if binary else json.loads(d)
        except Exception as e:
            time.sleep(3 * (i + 1)); last = e
    raise last
OK_LIC = re.compile(r'^(public domain|pd|cc0|cc[- ]by[- ]?\d|cc by \d)', re.I)
def lic_ok(m):
    s = (m.get('LicenseShortName', {}).get('value') or '')
    return bool(OK_LIC.match(s)) and 'sa' not in s.lower().split('by')[-1][:6], s
def q(params):
    p = dict(action='query', format='json', iiprop='url|extmetadata|mime|size', iiurlwidth=640, **params)
    return get(API + '?' + urllib.parse.urlencode(p))
def members(cat, limit=60):
    d = q(dict(generator='categorymembers', gcmtitle=cat, gcmtype='file', gcmlimit=limit, prop='imageinfo'))
    return list((d.get('query', {}).get('pages', {})).values())
def one(title):
    d = q(dict(titles=title, prop='imageinfo'))
    return list(d['query']['pages'].values())
plan = json.load(open(sys.argv[2]))
meta = []
for cat in plan:
    kind, n, src = cat['group'], cat['n'], cat['src']
    pages = []
    if src.startswith('search:'):
        d = q(dict(generator='search', gsrsearch=src[7:], gsrnamespace=6, gsrlimit=40, prop='imageinfo'))
        pages = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    elif src.startswith('Category:'):
        pages = members(src)
    else:
        for t in src.split('|'): pages += one(t)
    got = 0
    for p in pages:
        if got >= n: break
        ii = (p.get('imageinfo') or [None])[0]
        if not ii or ii['mime'] not in ('image/jpeg', 'image/png'): continue
        ok, lic = lic_ok(ii.get('extmetadata', {}))
        if not ok: continue
        if cat.get('skip') and any(s in p['title'].lower() for s in cat['skip']): continue
        fn = f"{kind}-{got+1:02d}.{'jpg' if ii['mime']=='image/jpeg' else 'png'}"
        try: data = get(ii['thumburl'], True)
        except Exception as e: print('fail', p['title'], e); continue
        if len(data) < 3000: continue
        open(os.path.join(OUT, fn), 'wb').write(data)
        meta.append(dict(file=fn, group=kind, title=p['title'], url=ii['descriptionurl'], licence=lic, bytes=len(data), expected=cat['expected'], source_category=src))
        got += 1; time.sleep(1.5)
    print(kind, got)
json.dump(meta, open(os.path.join(OUT, 'sources.json'), 'w'), indent=2)
