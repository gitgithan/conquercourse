"""Packs the eight rebuilt characters into public/assets/characters/cast/: a 96 px thumbnail each and index.json (id = first 16 hex of the glb's SHA-256, like the community characters).
usage (from pipelines/): PYTHONPATH=. uv run --no-project --with numpy --with pillow python ../data/eval/cc-chars-eight/scripts/make_cast.py GLB_DIR EVAL_FULL_MUSE OUT_DIR"""
import hashlib, json, os, shutil, sys
from charmaker import package

GLB, MUSE, OUT = sys.argv[1:4]
NAMES = {
    "c1-fox": ("Fox", "A friendly orange fox parkour runner in a teal headband and white running shoes."),
    "c2-hoodie": ("Skater", "A cheerful teenage skater with a big pink hair puff, a yellow hoodie and green shorts."),
    "c3-robot": ("Toy Robot", "A chunky toy robot with a round head, red boots and a blue chest panel."),
    "c4-cactus": ("Cactus", "A walking cactus in round sunglasses and tiny sneakers."),
    "c5-banana": ("Banana", "A banana wearing big sneakers and a sweatband, with tiny arms."),
    "c6-robocat": ("Robo Cat", "A four-armed robot cat standing on two legs."),
    "c7-jelly": ("Jelly", "A wobbly purple jellyfish with a dome head and many short tentacles for arms and legs."),
    "c8-blob": ("Potato Blob", "A round potato-shaped blob creature with huge eyes, short stubby legs and noodle arms."),
}
os.makedirs(OUT, exist_ok=True)
items = []
for cid, (name, prompt) in NAMES.items():
    glb = open(f"{GLB}/{cid}.glb", "rb").read()
    gid = hashlib.sha256(glb).hexdigest()[:16]
    shutil.copy(f"{GLB}/{cid}.glb", f"{OUT}/{gid}.glb")
    thumb = package.thumb_from(open(f"{MUSE}/images/{cid}.png", "rb").read(), open(f"{MUSE}/masks/{cid}.mask.png", "rb").read())
    open(f"{OUT}/{gid}.webp", "wb").write(thumb)
    items.append({"id": gid, "name": name, "prompt": prompt, "kind": "character", "file": f"{gid}.glb", "thumb": f"{gid}.webp", "bytes": len(glb)})
json.dump({"items": items}, open(f"{OUT}/index.json", "w"), indent=2)
print(json.dumps(items, indent=1))
