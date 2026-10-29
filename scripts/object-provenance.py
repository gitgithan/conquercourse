#!/usr/bin/env python3
"""Write public/assets/objects/provenance.json: one provenance record per library object (CC-221).

Reads public/assets/objects/index.json, finds each source photo under data/eval/*/inputs/ for its fingerprint and size, and takes the
source link from the photos.json files. Record shape: src/slice/provenance.ts. Run again whenever objects are added; `--check` only verifies."""
import glob, hashlib, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "public/assets/objects/index.json")
OUT = os.path.join(ROOT, "public/assets/objects/provenance.json")


def sources():
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "data/eval/*/photos.json"))):
        try:
            for p in json.load(open(f)):
                if isinstance(p, dict) and p.get("source"):
                    out.setdefault(p["photo"], p["source"])
        except (ValueError, TypeError):
            pass
    for m in re.finditer(r"\| `data/eval/[^`]*/inputs/([\w-]+)\.jpg` \|[^|]*\|[^|]*\| \[[^\]]*\]\(([^)]+)\)", open(os.path.join(ROOT, "docs/ASSETS.md")).read()):
        out.setdefault(m.group(1), m.group(2))
    return out


def build():
    idx = json.load(open(IDX))
    src = sources()
    objs = []
    for o in idx["objects"]:
        found = sorted(glob.glob(os.path.join(ROOT, "data/eval/*/inputs", o["photo"] + ".jpg")))
        if not found:
            raise SystemExit(f"no source photo for {o['name']} ({o['photo']})")
        b = open(found[0], "rb").read()
        w, h = Image.open(found[0]).size
        tex = 1024 if "texture 1024" in o.get("config", "") else 0
        objs.append({
            "version": 1, "id": o["name"], "glb": o["glb"], "name": o["name"], "source": "library",
            "photo": {"sha256": hashlib.sha256(b).hexdigest(), "width": w, "height": h, "id": o["photo"], "url": src.get(o["photo"]), "stored": False},
            "box": o["box"], "label": o["label"], "height_m": o["height_m"],
            "height_source": "typed" if not str(o.get("scale_source", "")).startswith("typical") else "typical",
            "pipeline": {"name": "photo_to_object", "model": "SAM 3 + SAM 3D Objects", "seed": 42, "texture": tex, "pad_retry": "padding" in o.get("config", "") and "no padding" not in o.get("config", "")},
            "credit": {"author": o["author"], "licence": o["licence"], "source_url": src.get(o["photo"]), "line": f"Photo by {o['author']}, {o['licence']}"},
            "created": "2026-10-30",
        })
    return {"schemaVersion": 1, "note": "Which photo made which 3D object. Photos are not stored here, only their fingerprint. Made by scripts/object-provenance.py.", "objects": objs}


if __name__ == "__main__":
    doc = json.dumps(build(), indent=2) + "\n"
    if "--check" in sys.argv:
        sys.exit(0 if os.path.exists(OUT) and open(OUT).read() == doc else "provenance.json is out of date: run scripts/object-provenance.py")
    open(OUT, "w").write(doc)
    print("wrote", OUT)
