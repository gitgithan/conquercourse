"""CC-133: join the four raw Course tiles into one 2x2 picture for the README.
Usage: python3 scripts/readme-shot-compose.py [rawDir] [outFile]
Each tile is cropped to 16:10 (centre) and shrunk to 638 x 398; the gutter is 4 px white; the whole is 1280 x 800.
Saved as WebP, quality lowered until the file is 300 KB or less.
"""
import os
import sys
from PIL import Image

raw = sys.argv[1] if len(sys.argv) > 1 else "../conquercourse-assets/readme-shots/course"
out = sys.argv[2] if len(sys.argv) > 2 else "docs/evidence/cc-133-readme-shots/course-2x2.webp"
GUT, TW, TH = 4, 638, 398
sheet = Image.new("RGB", (2 * TW + GUT, 2 * TH + GUT), "white")
for i in range(4):
    im = Image.open(os.path.join(raw, f"tile{i + 1}.png")).convert("RGB")
    w, h = im.size
    if w * 10 > h * 16:  # too wide: trim the sides
        nw = round(h * 16 / 10)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    elif w * 10 < h * 16:  # too tall: trim the bottom
        im = im.crop((0, 0, w, round(w * 10 / 16)))
    im = im.resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, ((i % 2) * (TW + GUT), (i // 2) * (TH + GUT)))
os.makedirs(os.path.dirname(out), exist_ok=True)
for q in (90, 85, 80, 75, 70, 60):
    sheet.save(out, "WEBP", quality=q, method=6)
    if os.path.getsize(out) <= 300_000:
        break
print(out, sheet.size, os.path.getsize(out), "bytes, quality", q)
