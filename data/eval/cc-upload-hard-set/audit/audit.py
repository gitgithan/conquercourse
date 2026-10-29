"""Audit of the 19 shipped objects: how easy was each source photo? Box share of the photo and background busyness outside the box."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
ROOT = "data/eval"
idx = json.load(open("public/assets/objects/index.json"))["objects"]
def find(photo):
    for d in ("cc-38-photo-to-3d", "cc-110-real-objects"):
        p = f"{ROOT}/{d}/inputs/{photo}.jpg"
        if os.path.exists(p): return p
rows, tiles = [], []
for o in idx:
    p = find(o["photo"]); im = Image.open(p).convert("RGB"); w, h = im.size
    x0, y0, x1, y1 = o["box"]
    share = (x1 - x0) * (y1 - y0) / (w * h)
    g = np.asarray(im.convert("L"), float)
    gy, gx = np.gradient(g); e = np.hypot(gx, gy) > 25
    m = np.ones_like(e); m[y0:y1, x0:x1] = False
    bg_edge = float(e[m].mean()) if m.any() else 0.0   # busy background = many strong edges outside the box
    bgpix = (m.mean())
    rows.append({"name": o["name"], "photo": o["photo"], "photo_px": [w, h], "box_share": round(share, 3), "bg_edge_density": round(bg_edge, 3), "bg_share": round(float(bgpix), 3)})
    t = im.copy(); d = ImageDraw.Draw(t); d.rectangle(o["box"], outline=(255, 0, 0), width=max(3, w // 150)); t.thumbnail((300, 300))
    d = ImageDraw.Draw(t); d.rectangle([0, 0, 300, 14], fill=(0, 0, 0)); d.text((2, 1), f'{o["name"]} {share:.0%} bg{bg_edge:.2f}', fill=(255, 255, 255)); tiles.append(t)
cols = 5; rowsn = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 304, rowsn * 304), (30, 30, 30))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 304, (i // cols) * 304))
sheet.save("data/eval/cc-upload-hard-set/audit/contact-sheet.jpg", quality=85)
json.dump(rows, open("data/eval/cc-upload-hard-set/audit/audit.json", "w"), indent=2)
for r in rows: print(r)
print("median box share", np.median([r["box_share"] for r in rows]), "median bg edge", np.median([r["bg_edge_density"] for r in rows]))
