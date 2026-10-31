"""Step 3: SAM 3D Objects (the deployed Modal app cc-photo-to-object, class Lift) lifts each Muse Image picture to a mesh.
The mask comes from SAM 3.1 (step 2), so the privacy step of the Mask class (which would blur a cartoon face) is skipped.
usage: PYTHONPATH=pipelines uv run --no-project --with modal --with pillow --with numpy --with scipy python 03_lift_modal.py IMAGES MASKS OUT [ids...]"""
import io, json, os, sys, time
import numpy as np
from PIL import Image
import modal
from ccpipe import padretry as pr

IMAGES, MASKS, OUT = sys.argv[1:4]
only = sys.argv[4:]
os.makedirs(OUT, exist_ok=True)
Lift = modal.Cls.from_name("cc-photo-to-object", "Lift")
runs = json.load(open(f"{OUT}/lift_runs.json")) if os.path.exists(f"{OUT}/lift_runs.json") else []  # earlier attempts stay in the log
SEED = int(os.environ.get("CC_SEED", "42"))
SCALE = float(os.environ.get("CC_SCALE", "1"))  # below 1 shrinks picture and mask first (a retry for lifts that lose the connection)
for f in sorted(os.listdir(IMAGES)):
    cid = f[:-4]
    if not f.endswith(".png") or (only and cid not in only) or os.path.exists(f"{OUT}/{cid}.npz"):
        continue
    img = Image.open(f"{IMAGES}/{f}").convert("RGB")
    msk = Image.open(f"{MASKS}/{cid}.mask.png").convert("L")
    if SCALE != 1:
        img = img.resize((round(img.width * SCALE), round(img.height * SCALE)), Image.LANCZOS); msk = msk.resize(img.size, Image.NEAREST)
    jpg = io.BytesIO(); img.save(jpg, "JPEG", quality=95)
    mp = io.BytesIO(); msk.save(mp, "PNG")
    jpeg, mask = jpg.getvalue(), mp.getvalue()
    mb = np.asarray(Image.open(io.BytesIO(mask)).convert("L")) > 127
    touches = pr.touches_border(mb)
    if touches:
        jpeg, mask = pr.pad_bytes(jpeg, mask)
    t0 = time.time()
    try:
        r = Lift().run.remote(jpeg, mask, SEED)
        open(f"{OUT}/{cid}.npz", "wb").write(r["npz"])
        runs.append({"id": cid, "seed": SEED, "scale": SCALE, "ok": True, "padded": bool(touches), "gpu_seconds": round(r["seconds"], 1), "load_seconds": round(r["load_seconds"], 1), "wall_seconds": round(time.time() - t0, 1), "raw_faces": r["n_faces"], "gaussians": r["n_gaussians"]})
    except Exception as ex:
        runs.append({"id": cid, "seed": SEED, "scale": SCALE, "ok": False, "error": str(ex)[:300], "wall_seconds": round(time.time() - t0, 1)})
    print(runs[-1], flush=True)
    json.dump(runs, open(f"{OUT}/lift_runs.json", "a" if False else "w"), indent=2)
