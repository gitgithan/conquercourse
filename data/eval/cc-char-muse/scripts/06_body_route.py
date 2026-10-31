"""Route B: SAM 3D Body (the CC-41 shape_from_photo method) on the same 8 Muse Image pictures. Humanoid only; it needs one person and a face, and returns shape numbers only (no colours).
usage: uv run --no-project --with modal --with pillow python 06_body_route.py IMAGES_DIR OUT_JSON"""
import io, json, os, sys, time
import modal
from PIL import Image

IMAGES, OUT = sys.argv[1:3]
Worker = modal.Cls.from_name(os.environ.get("CC_BODY_APP", "honest-motion"), "Worker")
runs = []
for f in sorted(os.listdir(IMAGES)):
    if not f.endswith(".png"):
        continue
    b = io.BytesIO(); Image.open(f"{IMAGES}/{f}").convert("RGB").save(b, "JPEG", quality=92)
    t0 = time.time()
    try:
        r = Worker().shape_from_photo.remote(b.getvalue())
        runs.append({"id": f[:-4], "ok": bool(r.get("ok")), "reason": r.get("reason"), "receipt": r.get("receipt"), "height_m": r.get("height_m_estimate"), "wall_seconds": round(time.time() - t0, 1)})
    except Exception as ex:
        runs.append({"id": f[:-4], "ok": False, "reason": "error: " + str(ex)[:200], "wall_seconds": round(time.time() - t0, 1)})
    print(runs[-1], flush=True)
    json.dump(runs, open(OUT, "w"), indent=2)
