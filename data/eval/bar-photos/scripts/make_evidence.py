"""Pictures for the README: Segment Objects outlines per photo (one contact sheet), and a stack of every lift's turntable.
usage: uv run --no-project --with numpy --with pillow python -I make_evidence.py   (from the repo root)"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
D = "data/eval/bar-photos"
os.makedirs(f"{D}/evidence", exist_ok=True)
tiles = []
for p in sorted(os.listdir(f"{D}/suggest")):
    s = json.load(open(f"{D}/suggest/{p}/suggest.json"))
    im = Image.open(f"{D}/prep/{p}.jpg").convert("RGB"); over = np.asarray(im).astype(float)
    for i, it in enumerate(s["items"]):
        x0, y0, x1, y1 = it["box"]
        c = np.asarray(Image.open(f"{D}/suggest/{p}/{it['cutout_file']}").convert("L").resize((x1 - x0, y1 - y0))) > 127
        col = np.array([(60, 120, 255), (255, 140, 0), (40, 200, 90), (230, 60, 160)][i % 4])
        reg = over[y0:y1, x0:x1]; reg[c] = reg[c] * 0.45 + col * 0.55
    out = Image.fromarray(over.astype("uint8")); dr = ImageDraw.Draw(out)
    for it in s["items"]:
        x0, y0, x1, y1 = it["box"]; dr.rectangle(it["box"], outline=(255, 255, 255), width=2); dr.text((x0 + 3, y0 + 3), f"{it['label']} {it['score']:.2f}", fill=(255, 255, 0))
    out.thumbnail((640, 480)); dr = ImageDraw.Draw(out); dr.text((4, 4), p, fill=(255, 0, 0)); tiles.append(out)
W = 3; c = Image.new("RGB", (W * 644, ((len(tiles) + W - 1) // W) * 484), "white")
for k, t in enumerate(tiles): c.paste(t, ((k % W) * 644, (k // W) * 484))
c.save(f"{D}/evidence/finder_all.jpg", quality=85)
rows = json.load(open(f"{D}/objects.json")) if os.path.exists(f"{D}/objects.json") else []
ts = [(o["name"], Image.open(f"{D}/lifts/{o['name']}/turntable.png").convert("RGB")) for o in rows if os.path.exists(f"{D}/lifts/{o['name']}/turntable.png")]
if ts:
    w = max(t.width for _, t in ts); h = sum(t.height + 4 for _, t in ts)
    c = Image.new("RGB", (w, h), "white"); y = 0; d = ImageDraw.Draw(c)
    for n, t in ts: c.paste(t, (0, y)); d.text((6, y + 4), n, fill=(200, 0, 0)); y += t.height + 4
    c.save(f"{D}/evidence/lifts_turntables.jpg", quality=85)
