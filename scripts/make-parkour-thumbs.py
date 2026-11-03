"""CC-133: 320x180 cover photos (under 40 KB) for parkour parks, from Wikimedia Commons photos picked by eye.
Usage: python3 -I scripts/make-parkour-thumbs.py <folder with the downloaded 800 px photos, named <slug>.jpg>
Writes public/assets/places/thumbs/<slug>.jpg and adds each credit to public/assets/places/thumbs/index.json (street entries stay as they were)."""
import json, os, sys
from PIL import Image
SRC = sys.argv[1]
BASE = 'public/assets/places'
C = 'https://commons.wikimedia.org/wiki/File:'
# slug: (file title, author, licence, licence url, crop centre as a share of the height, what the picture shows)
PICKS = {
    'gerlev-parkour-park': ('Gerlev Idrætshøjskole, Gerlev, Slagelse Kommune. Foto fra 10. maj 2022. Fotograf Hans Christian Hansen.jpg', 'XYZA-2400', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 0.5, 'the folk high school that hosts the park, about 220 m away'),
    'lakeside-garden-skatepark': ('Jurong Lake Gardens 10-11-2023(39).jpg', 'LN9267', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 0.5, 'the path in Jurong Lake Gardens, about 30 m from the park'),
    'regents-park-london': ("The Regent's Park Hub cafe - geograph.org.uk - 3362814.jpg", 'David Howard', 'CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0', 0.5, 'the Hub sports pavilion on the playing fields, about 250 m from the park'),
    'zollverein-parkour-essen': ('Zeche Zollverein Essen (21228047316).jpg', 'dronepicr', 'CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0', 0.3, 'the empty pool and coal works of the Zollverein site, about 100 m from the park'),
    'plaza-parkour-cochabamba': ('Ex matadero exterior 2.jpg', 'VASQUEZ RODRIGUEZ RAUL', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0', 0.5, 'the courtyard of the old slaughterhouse (mARTadero) beside the plaza, about 40 m away'),
}
idx_path = f'{BASE}/thumbs/index.json'
idx = json.load(open(idx_path))
for slug, (title, author, lic, licurl, cy, what) in PICKS.items():
    im = Image.open(f'{SRC}/{slug}.jpg').convert('RGB')
    w, h = im.size
    bh = int(w * 9 / 16)
    top = max(0, min(h - bh, int(h * cy - bh / 2))) if h > bh else 0
    im = im.crop((0, top, w, min(h, top + bh))).resize((320, 180), Image.LANCZOS)
    q = 80
    while True:
        im.save(f'{BASE}/thumbs/{slug}.jpg', 'JPEG', quality=q, optimize=True)
        if os.path.getsize(f'{BASE}/thumbs/{slug}.jpg') <= 38000 or q <= 40: break
        q -= 5
    idx[slug] = {'title': title, 'author': author, 'licence': lic, 'licenceUrl': licurl, 'source': C + title.replace(' ', '_'), 'shows': what}
    print(slug, os.path.getsize(f'{BASE}/thumbs/{slug}.jpg'), 'bytes q', q)
json.dump(idx, open(idx_path, 'w'), indent=2, ensure_ascii=False); open(idx_path, 'a').write('\n')
