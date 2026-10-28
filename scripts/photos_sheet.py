"""CC-90: a contact sheet (4 x 3 thumbnails, about 70 KB) of the photos picked by photos_coverage.py; photo bytes are not kept anywhere else."""
import io, json, sys, urllib.request
from PIL import Image, ImageDraw
out, slug = sys.argv[1], sys.argv[2]
picks = json.load(open(f"{out}/{slug}-sheet-picks.json"))
W, H, C = 240, 160, 4
sheet = Image.new("RGB", (W * C, H * ((len(picks) + C - 1) // C)), "white")
for i, p in enumerate(picks):
    try:
        raw = urllib.request.urlopen(urllib.request.Request(p["thumb"], headers={"User-Agent": "conquercourse-research/0.1"}), timeout=60).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB"); im.thumbnail((W, H))
    except Exception:
        im = Image.new("RGB", (W, H), "#ccc")
    x, y = (i % C) * W, (i // C) * H
    sheet.paste(im, (x, y))
    ImageDraw.Draw(sheet).text((x + 4, y + 4), str(i + 1), fill="yellow")
sheet.save(f"{out}/{slug}-sheet.jpg", quality=55, optimize=True)
print(slug, len(picks), "pictures")
