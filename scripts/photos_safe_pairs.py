"""CC-90: one contact sheet of before/after pairs from the safe allow-list (6 pairs, 2 per place, before on the left, 160 px tiles, heavy JPEG).
The before tile is tiny on purpose: no face can be told apart at this size. usage: photos_safe_pairs.py SLUG.. (repo root)"""
import json, os
import sys
from PIL import Image
W = 160
pairs = []
for slug in sys.argv[1:]:
    d = json.load(open(f"data/eval/cc-90-photos/masking/{slug}-safe.json"))
    rows = sorted((r for r in d["rows"] if r["keep"] and r["had_person"]), key=lambda r: -r["masked_share"])
    for r in (rows[len(rows) // 4], rows[len(rows) // 2]) if len(rows) > 1 else rows[:1]:
        pairs.append((slug, r["id"]))
tiles = []
for slug, pid in pairs:
    a = Image.open(os.path.expanduser(f"~/photos-cache/{pid}.jpg")).convert("RGB")
    b = Image.open(os.path.expanduser(f"~/photos-masked/{slug}/{pid}.jpg")).convert("RGB")
    a, b = [x.resize((W, int(W * x.height / x.width))) for x in (a, b)]
    tiles.append((a, b))
th = max(t[0].height for t in tiles)
canvas = Image.new("RGB", (4 * W, ((len(tiles) + 1) // 2) * th), "white")
for k, (a, b) in enumerate(tiles):
    x, y = (k % 2) * 2 * W, (k // 2) * th
    canvas.paste(a, (x, y)); canvas.paste(b, (x + W, y))
out = "data/eval/cc-90-photos/masking/safe-before-after-sheet.jpg"
canvas.save(out, quality=55)
print(out, os.path.getsize(out) // 1024, "KB", pairs)
