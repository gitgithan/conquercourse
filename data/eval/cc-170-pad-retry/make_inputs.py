"""Make the edge-touching test photos: tight crops of CC-110 photos (own derivative, same licence), box moved into crop coordinates.
Even rows: the crop is the box itself (the object fills the frame). Odd rows: 4 percent of margin on the top and right only (the object touches left and bottom).
Run from the repo root: python3 data/eval/cc-170-pad-retry/make_inputs.py"""
import json
from PIL import Image

SRC = "data/eval/cc-110-real-objects"
OUT = "data/eval/cc-170-pad-retry"
PICK = ["bollard-iron", "barrel-oak", "planter-concrete", "pipe-ring", "bench-concrete-curve", "stump-spruce", "bar-green", "bar-black", "picnic-table"]
ph = {p["photo"]: p for p in json.load(open(f"{SRC}/photos.json"))}
rows = []
for i, name in enumerate(PICK):
    p = ph[name]
    img = Image.open(f"{SRC}/inputs/{name}.jpg")
    x0, y0, x1, y1 = p["box"]
    w, h = x1 - x0, y1 - y0
    mt, mr = (0, 0) if i % 2 == 0 else (round(0.04 * h), round(0.04 * w))
    cx0, cy0, cx1, cy1 = x0, max(0, y0 - mt), min(img.width, x1 + mr), y1
    crop = img.crop((cx0, cy0, cx1, cy1))
    crop.save(f"{OUT}/inputs/{name}-edge.jpg", quality=95)
    rows.append({"photo": f"{name}-edge", "label": p["label"], "box": [x0 - cx0, y0 - cy0, x1 - cx0, y1 - cy0], "height_m": p["height_m"],
                 "from": name, "licence": p["licence"], "author": p["author"], "source": p["source"], "crop": [cx0, cy0, cx1, cy1]})
# a real photo that already touches the edge (CC-145), used as it is
g = ph["gabion-wall"]
Image.open(f"{SRC}/inputs/gabion-wall.jpg").save(f"{OUT}/inputs/gabion-wall.jpg", quality=95)
rows.append({"photo": "gabion-wall", "label": g["label"], "box": g["box"], "height_m": g["height_m"], "from": "gabion-wall", "licence": g["licence"], "author": g["author"], "source": g["source"], "crop": None})
json.dump(rows, open(f"{OUT}/photos.json", "w"), indent=2)
print(len(rows), "photos")
