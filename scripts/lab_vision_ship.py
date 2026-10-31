"""Lab 4 (Computer vision): turn the offline scores into the files the page ships.
usage: lab_vision_ship.py OUT_DIR DEST_DIR [--skip ID,ID] [--thumbs N]
Reads OUT_DIR/scores.json, meta.json, thumbs/ (from lab_vision_scores.py); writes
  DEST_DIR/scores.txt   one photo per line: id|union_mask_share_at_0.3|score,box,mask;...|size,find;...
  DEST_DIR/credits.json the photos with a thumbnail (source page and licence)
  DEST_DIR/t/<id>.jpg   thumbnails, at most 128 px wide, at most N of them (every k-th photo with at least one labelled person first)
--skip lists photo ids to leave out of the thumbnails (a look through the sheet found a child or an identifiable plate).
"""
import json, os, sys, shutil
from PIL import Image

out, dest = sys.argv[1], sys.argv[2]
skip = set(sys.argv[sys.argv.index("--skip") + 1].split(",")) if "--skip" in sys.argv else set()
nthumb = int(sys.argv[sys.argv.index("--thumbs") + 1]) if "--thumbs" in sys.argv else 36
sc = json.load(open(f"{out}/scores.json"))
meta = {m["id"]: m for m in json.load(open(f"{out}/meta.json"))}
os.makedirs(f"{dest}/t", exist_ok=True)
lines = ["# Lab 4 scores. id|union mask share (score >= 0.3)|find: score,box share,mask share ; ...|person: size share,matched find (-1 none) ; ...", f"# {sc['detector']}"]
f4 = lambda x: f"{x:.4f}".rstrip("0").rstrip(".") if x else "0"
for p in sc["photos"]:
    finds = ";".join(f"{s:.3f},{f4(b)},{f4(m)}" for s, b, m in p["det"])
    truth = ";".join(f"{f4(a)},{b}" for a, b in p["gt"])
    lines.append(f"{p['id']}|{f4(p['u30'])}|{finds}|{truth}")
open(f"{dest}/scores.txt", "w").write("\n".join(lines) + "\n")
cand = [p for p in sc["photos"] if str(p["id"]) not in skip]
with_p = [p for p in cand if p["gt"]]
none = [p for p in cand if not p["gt"]]
pick = with_p[:: max(1, len(with_p) // (nthumb - 6))][: nthumb - 4] + none[:4]
credits = []
for p in pick:
    i = p["id"]
    im = Image.open(f"{out}/thumbs/{i}.jpg"); im.thumbnail((128, 128)); im.save(f"{dest}/t/{i}.jpg", quality=50, optimize=True)
    m = meta[i]
    credits.append({"id": str(i), "flickr_url": m["flickr_url"], "licence": "CC BY 2.0" if m["license"] == 4 else "no known copyright restrictions"})
json.dump(credits, open(f"{dest}/credits.json", "w"), indent=2); open(f"{dest}/credits.json", "a").write("\n")
print(len(sc["photos"]), "photos", len(credits), "thumbs", sum(os.path.getsize(f"{dest}/t/{c['id']}.jpg") for c in credits), "bytes")
