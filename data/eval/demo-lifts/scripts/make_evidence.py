"""Pictures for the film and the README: Segment Objects outlines per photo, privacy before/after, and one overview of all lifts.
usage: uv run --no-project --with numpy --with pillow --with matplotlib python -I make_evidence.py   (from the repo root)"""
import io, json, os
import numpy as np
from PIL import Image, ImageDraw
D = "data/eval/demo-lifts"
os.makedirs(f"{D}/evidence", exist_ok=True)
for p in ("photo1", "photo2"):
    s = json.load(open(f"{D}/suggest/{p}/suggest.json"))
    mk = f"{D}/lifts/p1_bench_left/masked.jpg"  # photo 1 shows its privacy-blurred version everywhere in git; the unblurred picture stays outside git
    im = Image.open(mk if p == "photo1" and os.path.exists(mk) else f"{D}/prep/{p}.jpg").convert("RGB"); base = np.asarray(im).astype(float)
    over = base.copy(); dr = None
    for i, it in enumerate(s["items"]):
        x0, y0, x1, y1 = it["box"]
        c = np.asarray(Image.open(f"{D}/suggest/{p}/{it['cutout_file']}").convert("L").resize((x1 - x0, y1 - y0))) > 127
        col = np.array([(60, 120, 255), (255, 140, 0), (40, 200, 90), (230, 60, 160)][i % 4])
        reg = over[y0:y1, x0:x1]; reg[c] = reg[c] * 0.45 + col * 0.55
    out = Image.fromarray(over.astype("uint8")); dr = ImageDraw.Draw(out)
    for it in s["items"]:
        x0, y0, x1, y1 = it["box"]; dr.rectangle(it["box"], outline=(255, 255, 255), width=2); dr.text((x0 + 3, y0 + 3), f"{it['label']} {it['score']:.2f}", fill=(255, 255, 0))
    out.save(f"{D}/evidence/{p}_segment_objects.jpg", quality=88)
# privacy before / after (photo 1 has people; the masked photo comes back with every lift)
m = f"{D}/lifts/p1_bench_left/masked.jpg"
if os.path.exists(m):
    a, b = Image.open(f"{D}/prep/photo1.jpg").convert("RGB"), Image.open(m).convert("RGB")
    c = Image.new("RGB", (a.width, a.height * 2 + 6), "white"); c.paste(a, (0, 0)); c.paste(b, (0, a.height + 6)); c.save(f"{D}/evidence/photo1_privacy_before_after.jpg", quality=88)  # NOT committed: it shows the people before the blur
    b.save(f"{D}/evidence/photo1_privacy_after.jpg", quality=88)
# overview: each object's turntable strip stacked
rows = [json.load(open(f"{D}/objects.json"))][0]
tiles = [(o["name"], Image.open(f"{D}/lifts/{o['name']}/turntable.png").convert("RGB")) for o in rows if os.path.exists(f"{D}/lifts/{o['name']}/turntable.png")]
if tiles:
    w = max(t.width for _, t in tiles); h = sum(t.height + 4 for _, t in tiles)
    c = Image.new("RGB", (w, h), "white"); y = 0; d = ImageDraw.Draw(c)
    for n, t in tiles:
        c.paste(t, (0, y)); d.text((6, y + 4), n, fill=(200, 0, 0)); y += t.height + 4
    c.save(f"{D}/evidence/lifts_turntables.jpg", quality=88)
