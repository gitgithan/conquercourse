"""CC-90: contact sheet of masked photos (8 per place, 256 px) to look at by eye. usage: mask_sheet.py SLUG..  (run from the repo root; masked pictures are read from ~/photos-masked, not stored in the repo)"""
import json, os, sys
from PIL import Image
W = 256
for slug in sys.argv[1:]:
    d = json.load(open(f"data/eval/cc-90-photos/masking/{slug}-mask.json"))
    rows = [r for r in d["rows"] if r.get("had_person") and r.get("usable")]
    rows.sort(key=lambda r: -r["masked_share"])  # the hardest cases first: the most masked photos that are still counted usable
    pick = rows[:4] + rows[len(rows) // 2: len(rows) // 2 + 4]
    tiles = []
    for r in pick:
        f = os.path.expanduser(f"~/photos-masked/{slug}/{r['id']}.jpg")
        if os.path.exists(f):
            im = Image.open(f).convert("RGB")
            tiles.append(im.resize((W, int(W * im.height / im.width))))
    if not tiles:
        continue
    th = max(t.height for t in tiles)
    canvas = Image.new("RGB", (4 * W, ((len(tiles) + 3) // 4) * th), "white")
    for k, t in enumerate(tiles):
        canvas.paste(t, ((k % 4) * W, (k // 4) * th))
    out = f"data/eval/cc-90-photos/masking/{slug}-masked-sheet.jpg"
    canvas.save(out, quality=60)
    print(out, os.path.getsize(out) // 1024, "KB", [r["id"] for r in pick])
