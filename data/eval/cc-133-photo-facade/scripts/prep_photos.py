"""Step 0: shrink each original the way the browser does (src/slice/object-lift-client.ts shrinkPhoto): long side 1280 px, JPEG q 0.88 (no camera data), and a 640 px copy at q 0.8 for the safety check.
usage: python -I prep_photos.py ORIGINALS_DIR OUT_DIR   (needs pillow)"""
import glob, hashlib, json, os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rows = []
for f in sorted(glob.glob(f"{src}/photo*.jpg")):
    name = os.path.basename(f)[:-4]
    im = Image.open(f).convert("RGB"); w, h = im.size
    def draw(mx, q, path):
        k = min(1, mx / max(w, h)); r = im.resize((round(w * k), round(h * k)), Image.LANCZOS); r.save(path, "JPEG", quality=round(q * 100)); return r.size
    s = draw(1280, 0.88, f"{out}/{name}.jpg"); t = draw(640, 0.8, f"{out}/{name}_thumb.jpg")
    rows.append({"photo": name, "original": os.path.basename(f), "original_size": [w, h], "sent_size": list(s), "thumb_size": list(t), "scale": s[0] / w,
                 "sent_sha256": hashlib.sha256(open(f"{out}/{name}.jpg", "rb").read()).hexdigest()})
json.dump(rows, open(f"{out}/prep.json", "w"), indent=2)
print(rows)
