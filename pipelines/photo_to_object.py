"""Photo -> object (pipeline 7, CC-38): a photo, a box and a label become a textured, upright, sized GLB skin.

Steps:  privacy and mask (Modal L4, SAM 3)  ->  lift (Modal L40S, SAM 3D Objects, seed 42)  ->  bake and sheet (CPU, here).
Weights come from the read-only Modal volume `sam-checkpoints`; nothing is downloaded at run time.

usage:
  modal run pipelines/photo_to_object.py --exp data/eval/cc-38-photo-to-3d --rnd r1 [--only mural01,bench01]
  modal run pipelines/photo_to_object.py::check_lift_image        # CPU-only import check of the lift image (no GPU cost)
  python pipelines/photo_to_object.py bake --exp data/eval/cc-38-photo-to-3d --rnd r1 [--only ...]   # redo the CPU part from saved raw lifts

Inputs: `<exp>/photos.json` (photo, label, box in pixels x0 y0 x1 y1, optional height_m) and `<exp>/inputs/<photo>.jpg`.
Outputs per photo under `<exp>/<round>/<photo>/`: masked.jpg, mask.png, privacy.json, raw.npz (the lift), mesh.glb, mesh.json, sheet.png.
`<exp>/<round>/run.json` records GPU seconds and estimated dollars."""
import io
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

L40S_PER_SECOND = 1.95 / 3600
L4_PER_SECOND = 0.80 / 3600
CK = "/ck"
SEED = 42

try:
    import modal
except ImportError:  # the CPU-only `bake` command works without Modal
    modal = None

if modal is not None:
    app = modal.App("cc-photo-to-object")
    ck_vol = modal.Volume.from_name("sam-checkpoints")

    # ---- image 1: SAM 3 (privacy and mask), small ----
    mask_image = (
        modal.Image.debian_slim(python_version="3.11")
        .apt_install("git", "libgl1", "libglib2.0-0")
        .pip_install("torch==2.10.0", "torchvision", index_url="https://download.pytorch.org/whl/cu128")
        .pip_install("numpy<2", "scipy", "pillow", "timm>=1.0.17", "einops", "ftfy==6.1.1", "regex", "iopath", "tqdm",
                     "huggingface_hub", "typing_extensions", "pycocotools", "psutil")
        .run_commands("git clone --depth 1 https://github.com/facebookresearch/sam3 /opt/sam3 && pip install --no-deps -e /opt/sam3")
        .add_local_python_source("ccpipe")
    )

    # ---- image 2: SAM 3D Objects (lift). The fixes are the ones in docs/pipelines.md, pipeline 7. ----
    SAM3D_COMMIT_URL = "https://github.com/facebookresearch/sam-3d-objects"
    lift_image = (
        modal.Image.from_registry("nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04", add_python="3.11")
        .apt_install("git", "build-essential", "ninja-build", "libgl1", "libglib2.0-0", "libsm6", "libxext6", "libxrender1", "libegl1", "libgomp1")
        .env({
            "CUDA_HOME": "/usr/local/cuda", "CONDA_PREFIX": "/usr/local/cuda",  # the lift's code reads CUDA_HOME from CONDA_PREFIX
            "CC": "gcc", "CXX": "g++", "LDSHARED": "g++ -pthread -shared",       # Modal's Python was built with clang
            "TORCH_CUDA_ARCH_LIST": "8.0;8.6;8.9", "FORCE_CUDA": "1", "MAX_JOBS": "8",
        })
        .pip_install("wheel", "setuptools<76", "ninja", "packaging")                  # before every --no-build-isolation build
        .pip_install("torch==2.5.1", "torchvision==0.20.1", index_url="https://download.pytorch.org/whl/cu121")
        .pip_install("numpy<2", "iopath", "fvcore", "pillow")
        .run_commands("pip install --no-build-isolation 'git+https://github.com/facebookresearch/pytorch3d.git@75ebeeaea0908c5527e7b1e305fbc7681382db47'")
        .run_commands("pip install https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl")
        .run_commands("pip install kaolin==0.17.0 -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.5.1_cu121.html")
        .run_commands("pip install --no-build-isolation 'git+https://github.com/nerfstudio-project/gsplat.git@2323de5905d5e90e035f792fe65bad0fedd413e7'")
        .run_commands("pip install --no-build-isolation 'git+https://github.com/NVlabs/nvdiffrast.git@v0.3.3'")
        .pip_install("xformers==0.0.28.post3", "spconv-cu121==2.3.8", extra_index_url="https://pypi.nvidia.com")
        .pip_install(
            "astor==0.8.1", "easydict==1.13", "einops==0.8.0", "hydra-core==1.3.2", "omegaconf", "loguru==0.7.2", "lightning==2.3.3",
            "optree==0.14.1", "opencv-python-headless==4.9.0.80", "open3d==0.18.0", "igraph==0.11.8", "point-cloud-utils==0.29.5",
            "roma==1.5.1", "rootutils==1.0.7", "scikit-image==0.23.1", "timm==0.9.16", "trimesh", "plotly", "seaborn==0.13.2",
            "matplotlib", "scipy", "safetensors", "huggingface_hub<1", "tqdm", "pyyaml", "pandas", "jsonlines", "xatlas==0.0.9",
            "pymeshfix==0.17.0", "ftfy==6.2.0", "decord==0.6.0", "imageio", "imageio-ffmpeg", "pyglet<2", "pycocotools",
            "deprecation", "cuda-python==12.1.0", "webdataset", "easydict", "click",
        )
        .run_commands(
            f"git clone --depth 1 {SAM3D_COMMIT_URL} /opt/sam-3d-objects",
            "pip install 'git+https://github.com/EasternJournalist/utils3d.git@3913c65d81e05e47b9f367250cf8c0f7462a0900'",
            "pip install --no-deps 'git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b'",
            "pip install --no-deps -e /opt/sam-3d-objects",
            "python /opt/sam-3d-objects/patching/hydra",
            "pip install 'numpy==1.26.4' 'pandas==2.2.3'",  # a late layer pulled numpy 2, which the compiled wheels (kaolin, cv2, open3d) cannot load
        )
        .env({"PYTHONPATH": "/opt/sam-3d-objects", "LIDRA_SKIP_INIT": "true", "HF_HUB_CACHE": f"{CK}/hf/hub", "HF_HUB_OFFLINE": "1"})
    )

    def _png(arr_bool):
        from PIL import Image
        b = io.BytesIO()
        Image.fromarray((arr_bool.astype("uint8") * 255)).save(b, "PNG")
        return b.getvalue()

    # ---------- privacy and mask (L4) ----------
    @app.cls(gpu=["L4", "A10G", "L40S"], image=mask_image, volumes={CK: ck_vol}, timeout=1800, max_containers=1, scaledown_window=30)
    class Mask:
        @modal.enter()
        def load(self):
            t0 = time.time()
            from sam3.model_builder import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor
            self.p = Sam3Processor(build_sam3_image_model(checkpoint_path=f"{CK}/hf/sam3/sam3.pt", load_from_HF=False), confidence_threshold=0.3)
            self.load_s = time.time() - t0

        def _find(self, state, prompt, thr):
            import numpy as np
            self.p.reset_all_prompts(state)
            st = self.p.set_text_prompt(state=state, prompt=prompt)
            return [{"mask": m.squeeze().cpu().numpy().astype(bool), "score": float(s)}
                    for m, s in zip(st["masks"], st["scores"]) if float(s) >= thr]

        @modal.method()
        def run(self, jpeg, label, box):
            import torch
            with torch.autocast("cuda", dtype=torch.bfloat16):  # SAM 3's weights are bfloat16
                return self._run(jpeg, label, box)

        def _run(self, jpeg, label, box):
            import numpy as np
            from PIL import Image
            from ccpipe import objmask, privacy
            t0 = time.time()
            img = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"))
            h, w = img.shape[:2]
            state = self.p.set_image(Image.fromarray(img))
            people = [c["mask"] for c in self._find(state, "person", privacy.PERSON_T)]
            faces = [c["mask"] for c in self._find(state, "face", privacy.FACE_T)]
            plates = [c["mask"] for c in self._find(state, "license plate", privacy.PLATE_T)]
            safe, receipt = privacy.apply_privacy(img, people, faces, plates)
            # the object is found on the masked photo, so nothing recognisable is used from here on
            state = self.p.set_image(Image.fromarray(safe))
            cands = self._find(state, label, 0.3)
            i, o = objmask.pick_mask(cands, box)
            how = "text"
            if i is None:  # no candidate under the label overlaps the box: prompt with the box alone
                self.p.reset_all_prompts(state)
                x0, y0, x1, y1 = box
                st = self.p.add_geometric_prompt(box=[(x0 + x1) / 2 / w, (y0 + y1) / 2 / h, (x1 - x0) / w, (y1 - y0) / h], label=True, state=state)
                bx = [{"mask": m.squeeze().cpu().numpy().astype(bool), "score": float(s)} for m, s in zip(st["masks"], st["scores"])]
                if bx:
                    k = max(range(len(bx)), key=lambda j: bx[j]["score"])
                    mask, score, how = bx[k]["mask"], bx[k]["score"], "box-prompt"
                else:
                    mask, score, how = objmask.box_mask((h, w), box), None, "box-filled"
            else:
                mask, score = cands[i]["mask"], cands[i]["score"]
            b = io.BytesIO()
            Image.fromarray(safe).save(b, "JPEG", quality=95)
            return {"masked_jpeg": b.getvalue(), "mask_png": _png(mask), "privacy": receipt,
                    "mask": {"how": how, "score": score, "iou_with_box": o, "candidates": len(cands), "pixels": int(mask.sum())},
                    "seconds": time.time() - t0, "load_seconds": self.load_s}

    # ---------- lift (L40S) ----------
    @app.cls(gpu=["L40S", "A100-80GB"], image=lift_image, volumes={CK: ck_vol}, timeout=1800, max_containers=1, scaledown_window=30)
    class Lift:
        @modal.enter()
        def load(self):
            t0 = time.time()
            import torch
            from hydra.utils import instantiate
            from omegaconf import OmegaConf
            cfg = OmegaConf.load(f"{CK}/objects/hf/pipeline.yaml")
            cfg.rendering_engine = "pytorch3d"  # no nvdiffrast baking: the bake happens on the CPU
            cfg.compile_model = False
            cfg.workspace_dir = f"{CK}/objects/hf"
            self.pipe = instantiate(cfg)
            self.load_s = time.time() - t0

        @modal.method()
        def run(self, masked_jpeg, mask_png, seed=SEED):
            import numpy as np
            from PIL import Image
            t0 = time.time()
            img = np.asarray(Image.open(io.BytesIO(masked_jpeg)).convert("RGB"))
            mask = np.asarray(Image.open(io.BytesIO(mask_png)).convert("L")) > 127
            rgba = np.concatenate([img, (mask[..., None] * 255).astype(np.uint8)], -1)
            out = self.pipe.run(rgba, None, seed, stage1_only=False, with_mesh_postprocess=False, with_texture_baking=False,
                                with_layout_postprocess=False, use_vertex_color=True, stage1_inference_steps=None, pointmap=None)
            mesh, gs = out["mesh"][0], out["gs"]
            arrays = {
                "vertices": mesh.vertices.float().cpu().numpy(), "faces": mesh.faces.cpu().numpy().astype("int32"),
                "vertex_attrs": mesh.vertex_attrs[:, :3].float().cpu().numpy(),
                "splat_xyz": gs.get_xyz.detach().float().cpu().numpy(),
                "splat_dc": gs._features_dc.detach().float().cpu().reshape(-1, 3).numpy(),
                "splat_opacity": gs.get_opacity.detach().float().cpu().reshape(-1).numpy(),
            }
            for k in ("rotation", "translation", "scale"):  # kept for the record only; the bake never applies the layout
                if k in out:
                    arrays["layout_" + k] = out[k].detach().float().cpu().numpy()
            b = io.BytesIO()
            import numpy
            numpy.savez_compressed(b, **arrays)
            return {"npz": b.getvalue(), "seconds": time.time() - t0, "load_seconds": self.load_s,
                    "n_vertices": int(len(arrays["vertices"])), "n_faces": int(len(arrays["faces"])), "n_gaussians": int(len(arrays["splat_xyz"]))}

    @app.function(image=lift_image, volumes={CK: ck_vol}, timeout=1200)
    def check_lift_imports():
        """CPU only (no GPU is billed): can the lift's code and its dependencies be imported, and are the weights in place?"""
        import importlib
        out = {}
        for m in ("torch", "torchvision", "pytorch3d", "pytorch3d.renderer", "kaolin", "gsplat", "flash_attn", "xformers", "spconv.pytorch",
                  "open3d", "utils3d", "moge.model.v1", "hydra", "sam3d_objects", "sam3d_objects.pipeline.inference_pipeline_pointmap"):
            try:
                importlib.import_module(m)
                out[m] = "ok"
            except Exception as e:  # report every failure at once, not one per image build
                out[m] = f"{type(e).__name__}: {str(e)[:300]}"
        out["weights"] = sorted(os.listdir(f"{CK}/objects/hf"))[:30]
        return out

    @app.local_entrypoint()
    def check_lift_image():
        print(json.dumps(check_lift_imports.remote(), indent=2))

    @app.local_entrypoint()
    def main(exp: str = "data/eval/cc-38-photo-to-3d", rnd: str = "r1", only: str = "", grow: int = 0, k: int = 4, budget_usd: float = 4.0):
        photos = _photos(exp, only)
        out_root = f"{exp}/{rnd}"
        os.makedirs(out_root, exist_ok=True)
        mask_w, lift_w = Mask(), Lift()
        gpu = {"l4_seconds": 0.0, "l40s_seconds": 0.0}
        per = []
        for p in photos:
            d = f"{out_root}/{p['photo']}"
            os.makedirs(d, exist_ok=True)
            jpeg = open(f"{exp}/inputs/{p['photo']}.jpg", "rb").read()
            t0 = time.time()
            m = mask_w.run.remote(jpeg, p["label"], p["box"])
            mask_png = m["mask_png"]
            if grow:
                mask_png = _grow_png(mask_png, grow)
            r = lift_w.run.remote(m["masked_jpeg"], mask_png, SEED)
            wall = time.time() - t0
            open(f"{d}/masked.jpg", "wb").write(m["masked_jpeg"])
            open(f"{d}/mask.png", "wb").write(mask_png)
            open(f"{d}/raw.npz", "wb").write(r["npz"])
            json.dump({"privacy": m["privacy"], "mask": m["mask"]}, open(f"{d}/privacy.json", "w"), indent=2)
            gpu["l4_seconds"] += m["seconds"]
            gpu["l40s_seconds"] += r["seconds"]
            per.append({"photo": p["photo"], "mask_seconds": round(m["seconds"], 1), "lift_seconds": round(r["seconds"], 1),
                        "wall_seconds": round(wall, 1), "mask": m["mask"], "privacy": m["privacy"],
                        "n_faces_raw": r["n_faces"], "n_gaussians": r["n_gaussians"]})
            print(json.dumps(per[-1]))
            spent = _usd(gpu, m["load_seconds"], r["load_seconds"])
            if spent > budget_usd:
                print(f"STOP: estimated ${spent:.2f} passed the budget ${budget_usd}")
                break
        loads = {"mask_load_seconds": round(m["load_seconds"], 1), "lift_load_seconds": round(r["load_seconds"], 1)}
        run = {"experiment": "cc-38-photo-to-3d", "round": rnd, "issue": "CC-38", "date": time.strftime("%Y-%m-%d"), "seed": SEED,
               "settings": {"mask_grow_px": grow, "colour_k": k}, "photos": per, **loads,
               "gpu_seconds": {"l4": round(gpu["l4_seconds"] + m["load_seconds"]), "l40s": round(gpu["l40s_seconds"] + r["load_seconds"])},
               "gpu_minutes": round((gpu["l4_seconds"] + gpu["l40s_seconds"] + m["load_seconds"] + r["load_seconds"]) / 60, 1),
               "estimated_usd": round(_usd(gpu, m["load_seconds"], r["load_seconds"]), 3),
               "price_basis": "L40S $1.95/h, L4 $0.80/h, container seconds in methods plus one model load each; idle scale-down time not included"}
        json.dump(run, open(f"{out_root}/run.json", "w"), indent=2)
        bake_round(exp, rnd, only, k=k)


def _usd(gpu, l4_load, l40_load):
    return (gpu["l4_seconds"] + l4_load) * L4_PER_SECOND + (gpu["l40s_seconds"] + l40_load) * L40S_PER_SECOND


def _photos(exp, only):
    ps = json.load(open(f"{exp}/photos.json"))
    keep = [s for s in only.split(",") if s]
    return [p for p in ps if not keep or p["photo"] in keep]


def _grow_png(png, px):
    import numpy as np
    from PIL import Image
    from ccpipe import privacy
    m = np.asarray(Image.open(io.BytesIO(png)).convert("L")) > 127
    b = io.BytesIO()
    Image.fromarray((privacy.grow(m, px).astype("uint8") * 255)).save(b, "PNG")
    return b.getvalue()


def bake_round(exp, rnd, only="", k=4):
    """The CPU part: raw lift -> GLB, mesh.json and the contact sheet, for each photo of the round that has a raw.npz."""
    import numpy as np
    from ccpipe import glb, objbake, objsheet
    rows = []
    for p in _photos(exp, only):
        d = f"{exp}/{rnd}/{p['photo']}"
        if not os.path.exists(f"{d}/raw.npz"):
            continue
        t0 = time.time()
        raw = np.load(f"{d}/raw.npz")
        v, f, col, info = objbake.bake(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"],
                                       p["label"], p.get("height_m"), k=k)
        size = glb.write_glb(f"{d}/mesh.glb", v, f, col, name=p["photo"])
        info.update(photo=p["photo"], box=p["box"], bytes=size, model="SAM 3D Objects (seed 42)", bake_seconds=round(time.time() - t0, 2),
                    raw_faces=int(len(raw["faces"])), splat_points=int(len(raw["splat_xyz"])))
        json.dump(info, open(f"{d}/mesh.json", "w"), indent=2)
        objsheet.sheet(f"{exp}/inputs/{p['photo']}.jpg", p["box"], f"{d}/mask.png", v, f, col, f"{d}/sheet.png",
                       title=f"{p['photo']}: {p['label']}, {info['height_m']} m ({info['scale_source']})")
        rows.append(info)
        print(p["photo"], info["faces"], "faces", size, "bytes", info["height_m"], "m tilt", info["tilt_deg"])
    return rows


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["bake"])
    ap.add_argument("--exp", default="data/eval/cc-38-photo-to-3d")
    ap.add_argument("--round", default="r1")
    ap.add_argument("--only", default="")
    ap.add_argument("--k", type=int, default=4)
    a = ap.parse_args()
    bake_round(a.exp, a.round, a.only, a.k)
