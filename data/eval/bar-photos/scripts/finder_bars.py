"""For each photo, show only the bar-labelled Segment Objects outlines (pull-up bar, overhead bars, metal bars, bar grid), so a person can judge whether the finder found the bars.
usage: uv run --no-project --with numpy --with pillow python -I finder_bars.py   (from the repo root); writes evidence/finder_bars.jpg and finder_bars.json"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
D = "data/eval/bar-photos"; tiles = []; rec = {}
for p in sorted(os.listdir(f"{D}/suggest")):
    s = json.load(open(f"{D}/suggest/{p}/suggest.json")); im = Image.open(f"{D}/prep/{p}.jpg").convert("RGB"); a = np.asarray(im).astype(float) * 0.55
    bars = [it for it in s["items"] if it["label"] in ("pull-up bar", "overhead bars", "metal bars", "bar grid")]
    rec[p] = [{k: it[k] for k in ("label", "score", "box")} for it in bars]
    for it in bars:
        x0, y0, x1, y1 = it["box"]
        c = np.asarray(Image.open(f"{D}/suggest/{p}/{it['cutout_file']}").convert("L").resize((x1 - x0, y1 - y0))) > 127
        reg = a[y0:y1, x0:x1]; reg[c] = np.asarray(im).astype(float)[y0:y1, x0:x1][c] * 0.4 + np.array([255, 200, 40]) * 0.6
    t = Image.fromarray(a.clip(0, 255).astype("uint8")); d = ImageDraw.Draw(t)
    for it in bars: d.text((it["box"][0] + 3, it["box"][1] + 3), f"{it['label']} {it['score']:.2f}", fill=(255, 255, 255))
    t.thumbnail((640, 480)); ImageDraw.Draw(t).text((4, 4), f"{p}: {len(bars)} bar outline(s)", fill=(255, 0, 0)); tiles.append(t)
W = 3; c = Image.new("RGB", (W * 644, ((len(tiles) + W - 1) // W) * 484), "white")
for k, t in enumerate(tiles): c.paste(t, ((k % W) * 644, (k // W) * 484))
c.save(f"{D}/evidence/finder_bars.jpg", quality=85); json.dump(rec, open(f"{D}/evidence/finder_bars.json", "w"), indent=2)
