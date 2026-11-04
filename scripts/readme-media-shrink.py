"""CC-133: turn any README_MEDIA picture over 600 KB into a webp (quality 92 down to 76, first one that fits), then delete the png.
Run after the readme-shot-*.mjs scripts: python3 scripts/readme-media-shrink.py
"""
import os
from PIL import Image

LIMIT = 600_000
for f in sorted(os.listdir('README_MEDIA')):
    p = os.path.join('README_MEDIA', f)
    if not f.endswith('.png') or os.path.getsize(p) <= LIMIT:
        continue
    im = Image.open(p).convert('RGB')
    out = p[:-4] + '.webp'
    for q in (92, 88, 82, 76):
        im.save(out, 'WEBP', quality=q, method=6)
        if os.path.getsize(out) <= LIMIT:
            break
    print(f, 'to webp at quality', q, os.path.getsize(out), 'bytes')
    os.remove(p)
