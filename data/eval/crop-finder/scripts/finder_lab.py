"""Crop-finder lab (CC-133): does the Segment Objects finder find the monkey bars of photo 2 when helped by crops, upscaling, tiles and more phrases?

usage (repo root): uv run --no-project --with modal --with 'numpy<2' --with pillow --with scipy python -I data/eval/crop-finder/scripts/finder_lab.py PHOTO_JPG OUT_JSON

One Modal container (L4, own throw-away app cc-crop-finder-lab, not the deployed one; same image and weights as cc-photo-to-object).
Privacy first on the full photo (as the product does), then SAM 3 text phrases on every view; raw candidates down to a score of 0.10 come back with boxes in FULL-photo pixels.
Nothing is cut by the cap of 12 or by the merge rule: scoring.py decides what each variant keeps."""
import io, json, os, sys, time
sys.path.insert(0, os.path.join(os.getcwd(), "pipelines"))
import modal
import photo_to_object as p2o

app = modal.App("cc-crop-finder-lab")
OLD = ["bench", "stairs", "railing", "wall", "bollard", "planter", "tree trunk", "log", "pull-up bar", "fence", "picnic table", "slide", "ledge", "box", "pole", "monkey bars", "string lights"]
NEW = ["overhead ladder", "horizontal ladder", "bar grid", "metal bars", "climbing frame", "overhead bars", "ladder", "gymnastic bars"]
FLOOR = 0.10
# views in full-photo pixels: (name, x0, y0, x1, y1, scale)
VIEWS = [("full", 0, 0, 1280, 960, 1), ("full_x2", 0, 0, 1280, 960, 2),
         ("upper_half", 0, 0, 1280, 480, 1), ("upper_half_x2", 0, 0, 1280, 480, 2),
         ("loops_region", 450, 150, 1150, 480, 1), ("loops_region_x2", 450, 150, 1150, 480, 2),
         ("left_region", 0, 250, 520, 520, 1), ("left_region_x2", 0, 250, 520, 520, 2)]
for r in range(3):          # tiles: 640x480 windows, stride 320x240, each shown at 2x
    for c in range(3):
        VIEWS.append((f"tile_{r}{c}_x2", c * 320, r * 240, c * 320 + 640, r * 240 + 480, 2))


@app.cls(gpu=["L4", "A10G"], image=p2o.mask_image.add_local_file("pipelines/photo_to_object.py", "/root/photo_to_object.py"), volumes={p2o.CK: p2o.ck_vol}, timeout=1800, max_containers=1)
class Lab:
    @modal.enter()
    def load(self):
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor
        self.p = Sam3Processor(build_sam3_image_model(checkpoint_path=f"{p2o.CK}/hf/sam3/sam3.pt", load_from_HF=False), confidence_threshold=FLOOR)

    @modal.method()
    def run(self, jpeg):
        import numpy as np, torch
        from PIL import Image
        from ccpipe import privacy
        with torch.autocast("cuda", dtype=torch.bfloat16):
            img = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"))
            st = self.p.set_image(Image.fromarray(img))
            def find(state, ph):
                self.p.reset_all_prompts(state)
                s = self.p.set_text_prompt(state=state, prompt=ph)
                return [(m.squeeze().cpu().numpy().astype(bool), float(sc)) for m, sc in zip(s["masks"], s["scores"]) if float(sc) >= FLOOR]
            people = [m for m, _ in [c for c in find(st, "person") if c[1] >= privacy.PERSON_T]]
            faces = [m for m, _ in [c for c in find(st, "face") if c[1] >= privacy.FACE_T]]
            plates = [m for m, _ in [c for c in find(st, "license plate") if c[1] >= privacy.PLATE_T]]
            safe, receipt = privacy.apply_privacy(img, people, faces, plates)
            out = {"privacy": receipt, "views": {}}
            for name, x0, y0, x1, y1, sc in VIEWS:
                t0 = time.time()
                crop = Image.fromarray(safe[y0:y1, x0:x1])
                if sc != 1:
                    crop = crop.resize((crop.width * sc, crop.height * sc), Image.LANCZOS)
                state = self.p.set_image(crop)
                rows = []
                for ph in OLD + NEW:
                    for m, score in find(state, ph):
                        ys, xs = np.nonzero(m)
                        if not len(xs):
                            continue
                        b = [x0 + xs.min() / sc, y0 + ys.min() / sc, x0 + (xs.max() + 1) / sc, y0 + (ys.max() + 1) / sc]
                        rows.append({"phrase": ph, "score": round(score, 3), "box": [round(float(v)) for v in b],
                                     "mask_px_full": round(float(m.sum()) / (sc * sc)), "fill": round(float(m.sum()) / ((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)), 3)})
                out["views"][name] = {"seconds": round(time.time() - t0, 2), "cands": rows}
                print(name, round(time.time() - t0, 1), len(rows), flush=True)
            return out


if __name__ == "__main__":
    jpeg = open(sys.argv[1], "rb").read()
    t0 = time.time()
    with modal.enable_output(), app.run():
        res = Lab().run.remote(jpeg)
    res["wall_seconds_incl_cold_start"] = round(time.time() - t0, 1)
    res["floor"] = FLOOR
    json.dump(res, open(sys.argv[2], "w"), indent=2)
    print({k: v["seconds"] for k, v in res["views"].items()}, res["wall_seconds_incl_cold_start"])
