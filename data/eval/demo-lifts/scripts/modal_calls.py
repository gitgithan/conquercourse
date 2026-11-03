"""Steps 2 to 4 on Modal (the deployed app cc-photo-to-object, the same jobs the site calls): privacy + Segment Objects suggestions, then per object mask + lift.
usage: uv run --no-project --with modal --with 'numpy<2' --with pillow --with scipy python -I modal_calls.py suggest|maskbox|lift [--only name,name]
Run from the repo root. Reads prep/prep.json and objects.json; writes suggest/<photo>/ and lifts/<name>/ (masked.jpg, mask.png, privacy.json, lift_input.jpg, raw.npz, calls.json).
Costs are the container seconds returned by the jobs: L4 $0.80/h (SAM 3), L40S $1.95/h (SAM 3D Objects); model-load and idle scale-down time are not in the seconds."""
import io, json, os, sys, time
import modal
D = "data/eval/demo-lifts"
sys.path.insert(0, "pipelines")
from ccpipe import padretry as pr
Mask = modal.Cls.from_name("cc-photo-to-object", "Mask")()
Lift = modal.Cls.from_name("cc-photo-to-object", "Lift")()
SEED = 42


def retry(call, tries=4):
    """A cold container can drop the stream on a slow link (docs/pipelines.md): ask again, the container keeps starting."""
    for i in range(tries):
        try:
            return call()
        except Exception as e:  # noqa: BLE001
            print(f"call failed ({type(e).__name__}); try {i + 1} of {tries}", flush=True)
            if i == tries - 1:
                raise
            time.sleep(15)
prep = {r["photo"]: r for r in json.load(open(f"{D}/prep/prep.json"))}
mode = sys.argv[1]
only = (sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else [])

if mode == "maskbox":
    # Segment first, show, then lift (owner principle 2026-11-03): for each lab box, the same cheap box-prompted cut-out the product shows before a lift.
    # It writes evidence/maskbox_<name>.jpg (the cut-out lit up on the blurred photo, with the box). The lift mode refuses an object whose picture is missing.
    import numpy as np
    from PIL import Image
    os.makedirs(f"{D}/evidence", exist_ok=True)
    for o in json.load(open(f"{D}/objects.json")):
        if only and o["name"] not in only:
            continue
        s = prep[o["photo"]]["scale"]
        box = [round(v * s) for v in o["box_original"]]
        res = retry(lambda: Mask.mask_box.remote(open(f"{D}/prep/{o['photo']}.jpg", "rb").read(), [float(v) for v in box]))
        im = Image.open(f"{D}/prep/{o['photo']}.jpg").convert("RGB")  # the lab photo is the shrunk original; the product shows the same photo, blurred on the server
        if res["items"]:
            it = res["items"][0]; cut = Image.open(io.BytesIO(it["cutout"])).convert("L")
            x0, y0, x1, y1 = it["box"]; cut = cut.resize((x1 - x0, y1 - y0))
            a = np.asarray(im).astype("float32"); m = np.zeros(a.shape[:2], bool); m[y0:y1, x0:x1] = np.asarray(cut) > 127
            a[m] = a[m] * 0.5 + np.array([45, 156, 219]) * 0.5; im = Image.fromarray(a.astype("uint8"))
        from PIL import ImageDraw
        ImageDraw.Draw(im).rectangle(box, outline=(255, 209, 102), width=3)
        im.save(f"{D}/evidence/maskbox_{o['name']}.jpg", quality=85)
        if res["items"]:
            open(f"{D}/evidence/maskbox_{o['name']}_cutout.png", "wb").write(res["items"][0]["cutout"])  # small; the browser check replays it
        json.dump({"object": o["name"], "box_sent": box, "found": bool(res["items"]), "item": {k: v for k, v in (res["items"][0] if res["items"] else {}).items() if k != "cutout"}, "seconds": round(res["seconds"], 1)}, open(f"{D}/evidence/maskbox_{o['name']}.json", "w"), indent=2)
        print(o["name"], "cut-out" if res["items"] else "NO CLEAR SHAPE", round(res["seconds"], 1), "s")
elif mode == "suggest":
    for name, r in prep.items():
        out = f"{D}/suggest/{name}"; os.makedirs(out, exist_ok=True)
        t0 = time.time()
        res = retry(lambda: Mask.suggest.remote(open(f"{D}/prep/{name}.jpg", "rb").read()))
        items = []
        for i, it in enumerate(res["items"]):
            open(f"{out}/cutout_{i:02d}.png", "wb").write(it["cutout"])
            items.append({k: v for k, v in it.items() if k != "cutout"} | {"cutout_file": f"cutout_{i:02d}.png"})
        json.dump({"photo": name, "items": items, "privacy": res["privacy"], "job_seconds": round(res["seconds"], 1), "wall_seconds": round(time.time() - t0, 1)}, open(f"{out}/suggest.json", "w"), indent=2)
        print(name, [(i["label"], i["score"], i["box"]) for i in items], res["privacy"], res["seconds"])
else:
    for o in json.load(open(f"{D}/objects.json")):
        if only and o["name"] not in only:
            continue
        if not os.path.exists(f"{D}/evidence/maskbox_{o['name']}.jpg"):
            sys.exit(f"{o['name']}: no cut-out picture yet. Run the maskbox step first and look at {D}/evidence/maskbox_{o['name']}.jpg; a lift is made only from a cut-out that was seen and confirmed.")
        d = f"{D}/lifts/{o['name']}"; os.makedirs(d, exist_ok=True)
        s = prep[o["photo"]]["scale"]
        box = [round(v * s) for v in o["box_original"]]
        jpeg = open(f"{D}/prep/{o['photo']}.jpg", "rb").read()
        t0 = time.time()
        m = retry(lambda: Mask.run.remote(jpeg, o["label"], box))
        open(f"{d}/masked.jpg", "wb").write(m["masked_jpeg"]); open(f"{d}/mask.png", "wb").write(m["mask_png"])
        mb = pr.touches_border(__import__("numpy").asarray(__import__("PIL.Image", fromlist=["x"]).open(io.BytesIO(m["mask_png"])).convert("L")) > 127)
        lj, lm = m["masked_jpeg"], m["mask_png"]
        padded = False
        if mb:
            lj, lm = pr.pad_bytes(lj, lm); padded = True
        open(f"{d}/lift_input.jpg", "wb").write(lj)
        call = retry(lambda: Lift.run.spawn(lj, lm, SEED))  # spawn and poll: a long cold start never holds one stream open
        print("lift call id", call.object_id, flush=True)
        r = None
        while r is None:
            try:
                r = call.get(timeout=20)
            except TimeoutError:
                pass
            except Exception as e:  # noqa: BLE001
                print(f"poll failed ({type(e).__name__}); asking again", flush=True); time.sleep(10)
        open(f"{d}/raw.npz", "wb").write(r["npz"])
        chk = pr.lift_check(r["npz"], m["mask_png"])
        json.dump({"object": o, "box_sent": box, "label": o["label"], "privacy": m["privacy"], "mask": m["mask"], "touches_border": mb, "padded": padded, "lift_check": chk,
                   "mask_seconds": round(m["seconds"], 1), "lift_seconds": round(r["seconds"], 1), "n_faces_raw": r["n_faces"], "n_gaussians": r["n_gaussians"],
                   "mask_load_seconds": round(m["load_seconds"], 1), "lift_load_seconds": round(r["load_seconds"], 1), "wall_seconds": round(time.time() - t0, 1),
                   "usd_estimate": round(m["seconds"] * 0.80 / 3600 + r["seconds"] * 1.95 / 3600, 4)}, open(f"{d}/lift.json", "w"), indent=2, default=str)
        print(o["name"], m["mask"], "lift", round(r["seconds"], 1), "s", r["n_faces"], "faces")
