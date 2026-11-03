"""Evidence picture (CC-133): photo 2 with the two red boxes and the top-12 outlines of variant V4 (upper-half crop at 2x, old + new phrases, floor 0.10, geometry check).
usage: uv run --no-project --with pillow python -I make_evidence.py PHOTO_JPG LAB_JSON OUT_JPG"""
import json, sys
from PIL import Image, ImageDraw
photo, lab, out = sys.argv[1:4]
L = json.load(open(lab))
def iou(a, b):
    i = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    return i / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - i) if i else 0
def ok(b):
    w, h = b[2]-b[0], b[3]-b[1]
    return w >= 120 and h > 0 and w/h >= 2.5 and h <= 160
cs = sorted([c for c in L["views"]["upper_half_x2"]["cands"] if c["score"] >= 0.10 and ok(c["box"])], key=lambda c: -c["score"])
kept = []
for c in cs:
    if all(iou(c["box"], k["box"]) < 0.6 for k in kept): kept.append(c)
    if len(kept) == 12: break
im = Image.open(photo).convert("RGB"); d = ImageDraw.Draw(im)
S = 1280 / 1010
for b in [(450, 208, 820, 296), (45, 272, 320, 335)]:
    d.rectangle([round(v * S) for v in b], outline=(255, 0, 0), width=3)
for i, c in enumerate(kept, 1):
    d.rectangle(c["box"], outline=(0, 255, 255), width=2)
    d.text((c["box"][0] + 3, c["box"][1] + 2), f"{i} {c['phrase']} {c['score']:.2f}", fill=(255, 255, 0))
im.save(out, quality=90)
