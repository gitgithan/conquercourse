"""CC-207: 320x180 thumbnails (under 40 KB) of the first stored photo of a Ready place, for the place gallery on the slicing screen.
The photos are the Wikimedia Commons ones already in the repo (public/assets/places/<folder>/photo-1.jpg, credits in credits.json). No new download.
Writes public/assets/places/thumbs/<slug>.jpg and public/assets/places/thumbs/index.json (credit per thumbnail)."""
import json, os
from PIL import Image
FOLDER = {'montmartre-paris': 'montmartre-paris', 'eixample-barcelona': 'eixample-barcelona', 'circular-quay-sydney': 'circular-quay-sydney', 'lombard-street-san-francisco': 'san-francisco-lombard'}
base = 'public/assets/places'
out = {}
for slug, folder in FOLDER.items():
    cr = json.load(open(f'{base}/{folder}/credits.json'))['photos'][0]
    im = Image.open(f'{base}/{folder}/{cr["file"]}').convert('RGB')
    w, h = im.size
    box_h = int(w * 9 / 16)
    top = max(0, (h - box_h) // 2)
    im = im.crop((0, top, w, min(h, top + box_h))).resize((320, 180), Image.LANCZOS)
    q = 80
    while True:
        im.save(f'{base}/thumbs/{slug}.jpg', 'JPEG', quality=q, optimize=True)
        if os.path.getsize(f'{base}/thumbs/{slug}.jpg') <= 38000 or q <= 40: break
        q -= 5
    out[slug] = {k: cr[k] for k in ('title', 'author', 'licence', 'licenceUrl', 'source')}
    print(slug, os.path.getsize(f'{base}/thumbs/{slug}.jpg'), 'bytes q', q)
json.dump(out, open(f'{base}/thumbs/index.json', 'w'), indent=2, ensure_ascii=False); open(f'{base}/thumbs/index.json', 'a').write('\n')
