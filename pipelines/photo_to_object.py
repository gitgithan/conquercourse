"""Photo -> object (pipeline 7, CC-38): a photo, a box and a label become a textured, upright, sized GLB skin.

The box is never drawn by a player: in the Community flow it is the box of the object the player clicked after "Segment Objects" (the suggest job), and in experiments it comes from photos.json.

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
    @app.cls(gpu=["L4", "A10G", "L40S"], image=mask_image, volumes={CK: ck_vol}, timeout=1800, max_containers=1, scaledown_window=60)  # SAM 3 peaks at 5.4 GB and a phrase takes ~0.08 s on an L4 (data/eval/sam-compare): a cheap GPU, released after 60 s
    class Mask:
        @modal.enter()
        def load(self):
            t0 = time.time()
            from sam3.model_builder import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor
            self.p = Sam3Processor(build_sam3_image_model(checkpoint_path=f"{CK}/hf/sam3/sam3.pt", load_from_HF=False), confidence_threshold=0.3)
            self.load_s = time.time() - t0

        @modal.method()
        def ping(self):
            return "ok"  # the enter hook above has loaded the model by the time this runs: it only exists to wake the container (CC-133)

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

        @modal.method()
        def suggest(self, jpeg):
            import torch
            with torch.autocast("cuda", dtype=torch.bfloat16):
                return self._suggest(jpeg)

        def _suggest(self, jpeg):
            """Things worth picking on the photo (CC-248): one SAM 3 text prompt per common phrase, on the privacy-blurred photo, de-duplicated."""
            import numpy as np
            from PIL import Image
            from ccpipe import privacy, suggest as sg
            t0 = time.time()
            img = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"))
            h, w = img.shape[:2]
            state = self.p.set_image(Image.fromarray(img))
            people = [c["mask"] for c in self._find(state, "person", privacy.PERSON_T)]
            faces = [c["mask"] for c in self._find(state, "face", privacy.FACE_T)]
            plates = [c["mask"] for c in self._find(state, "license plate", privacy.PLATE_T)]
            safe, receipt = privacy.apply_privacy(img, people, faces, plates)
            receipt["person_boxes"] = privacy.mask_boxes(list(people) + list(faces))  # CC-133: the page refuses a hand-marked box that covers a person or a face
            state = self.p.set_image(Image.fromarray(safe))
            cands = [{"label": ph, "mask": c["mask"], "score": c["score"]} for ph in sg.PHRASES for c in self._find(state, ph, 0.35)]
            items = [sg.describe(c) for c in sg.pick(cands, (h, w))]
            return {"items": items, "privacy": receipt, "seconds": time.time() - t0}

    # ---------- lift (L40S) ----------
    @app.cls(gpu=["L40S", "A100-80GB"], image=lift_image, volumes={CK: ck_vol}, timeout=1800, max_containers=1, scaledown_window=240)
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
        def ping(self):
            return "ok"  # wakes the container so the model is loaded before a lift is asked for (CC-133)

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

    # ---------- the player upload path (CC-221): submit a job, poll for the result ----------
    # A job takes minutes on a cold container, so the web calls never wait for it: `submit` starts the job and returns its id, `status` asks for the result.
    # Both check a shared token (Modal secret `cc-upload`, key CC_UPLOAD_TOKEN) that only the site's server holds; nothing is stored: the photo lives in memory for the job.
    web_image = (
        modal.Image.debian_slim(python_version="3.11")
        .pip_install("numpy<2", "scipy", "pillow", "xatlas==0.0.9", "fast-simplification", "fastapi[standard]")
        .add_local_python_source("ccpipe")
    )
    # the shared token lives in the Modal secret `cc-upload`; `modal run` of the batch pipeline does not need it, so it is only attached when deploying (CC_DEPLOY_WEB=1 modal deploy ...)
    upload_secrets = [modal.Secret.from_name("cc-upload")]  # always attached: a condition on the deploy shell made the container see a different graph (crash loop)

    @app.function(image=web_image, timeout=1500, secrets=upload_secrets)
    def lift_job(jpeg: bytes, label: str, box: list, height_m=None, padretry: bool = True) -> dict:
        """photo + box + label -> {glb, mesh, privacy, mask, retry, gpu seconds}; the same steps as `main`, for one photo, in memory."""
        import tempfile
        import numpy as np
        from ccpipe import glb as glbmod, objbake, padretry as pr
        t0 = time.time()
        _stage("cutting")
        m = Mask().run.remote(jpeg, label, box)
        mask_png = m["mask_png"]
        retry = {"enabled": padretry, "touches": pr.touches_border(_mask_bool(mask_png)), "padded": False}
        lift_jpeg, lift_mask = m["masked_jpeg"], mask_png
        if padretry and retry["touches"]:
            lift_jpeg, lift_mask = pr.pad_bytes(lift_jpeg, lift_mask)
            retry["padded"] = True
        _stage("shape")
        r = Lift().run.remote(lift_jpeg, lift_mask, SEED)
        _stage("colour")
        retry.update(pr.lift_check(r["npz"], mask_png))
        retry["note"] = pr.decide(retry["touches"], retry["padded"], retry["bad"])
        raw = np.load(io.BytesIO(r["npz"]))
        v, f, uv, tex, info = objbake.bake_textured(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], label, height_m, k=4, texture_size=1024)
        with tempfile.NamedTemporaryFile(suffix=".glb") as t:
            nbytes = glbmod.write_glb(t.name, v, f, None, name="user-object", uv=uv, texture=tex)
            data = open(t.name, "rb").read()
        info.update(bytes=nbytes, model="SAM 3D Objects (seed 42)", raw_faces=int(len(raw["faces"])))
        _stage("done")
        return {"glb": data, "mesh": info, "privacy": m["privacy"], "mask": m["mask"], "retry": retry,
                "seconds": {"mask": round(m["seconds"], 1), "lift": round(r["seconds"], 1), "wall": round(time.time() - t0, 1)}}

    # Stage names the page shows as plain words (src/slice/stages.ts). A job writes its stage under its own call id; `status` hands it back while the job runs.
    # Nothing but a stage name and a time is kept, and a failed write never stops a job.
    stages_dict = modal.Dict.from_name("cc-job-stages", create_if_missing=True)

    def _stage(name):
        try:
            stages_dict.put(modal.current_function_call_id(), {"stage": name, "at": round(time.time(), 1)})
        except Exception:  # noqa: BLE001
            pass

    def _stage_of(call_id):
        try:
            got = stages_dict.get(call_id)
            return {"stage": got["stage"], "since": got["at"]} if got else {}
        except Exception:  # noqa: BLE001
            return {}

    def _check_token(token):
        import hmac
        want = os.environ.get("CC_UPLOAD_TOKEN", "")
        return bool(want) and hmac.compare_digest(str(token or ""), want)

    @app.function(image=web_image, secrets=upload_secrets)
    @modal.fastapi_endpoint(method="POST")
    def submit(item: dict):
        """{token, image: base64 jpeg, label, box: [x0,y0,x1,y1], height_m?, padretry?} -> {id} to poll, or {error}."""
        import base64
        from PIL import Image
        from ccpipe import upload
        if not _check_token(item.get("token")):
            return {"error": "not allowed"}
        try:
            jpeg = base64.b64decode(item.get("image") or "", validate=True)
            Image.open(io.BytesIO(jpeg)).verify()
        except Exception:  # noqa: BLE001
            return {"error": "bad photo"}
        clean, why = upload.check(jpeg, item.get("label"), item.get("box"), item.get("height_m"), Image.open(io.BytesIO(jpeg)).size)
        if why:
            return {"error": why}
        call = lift_job.spawn(jpeg, clean["label"], clean["box"], clean["height_m"], bool(item.get("padretry", True)))
        return {"id": call.object_id}

    @app.function(image=web_image, secrets=upload_secrets)
    @modal.fastapi_endpoint(method="POST")
    def status(item: dict):
        """{token, id} -> {state: running} | {state: done, glb: base64, mesh, privacy, mask, retry, seconds} | {state: failed, reason}."""
        import base64
        from modal.functions import FunctionCall
        if not _check_token(item.get("token")):
            return {"state": "failed", "reason": "not allowed"}
        try:
            call = FunctionCall.from_id(str(item.get("id") or ""))
            out = call.get(timeout=0)
        except TimeoutError:
            return {"state": "running", **_stage_of(str(item.get("id") or ""))}
        except Exception as e:  # noqa: BLE001
            return {"state": "failed", "reason": f"the lift stopped ({type(e).__name__})"}
        out = dict(out)
        out["glb"] = base64.b64encode(out["glb"]).decode()
        return {"state": "done", **out}

    @app.function(image=web_image, timeout=600, secrets=upload_secrets)
    def suggest_job(jpeg: bytes) -> dict:
        """photo -> {items: [{label, score, box, cutout png}], privacy, seconds}: the clickable suggestions on the Communities page (CC-248)."""
        _stage("finding")
        return Mask().suggest.remote(jpeg)

    @app.function(image=web_image, secrets=upload_secrets)
    @modal.fastapi_endpoint(method="POST")
    def suggest_submit(item: dict):
        """{token, image: base64 jpeg} -> {id} to poll, or {error}."""
        import base64
        from PIL import Image
        from ccpipe import upload
        if not _check_token(item.get("token")):
            return {"error": "not allowed"}
        try:
            jpeg = base64.b64decode(item.get("image") or "", validate=True)
            size = Image.open(io.BytesIO(jpeg)).size
        except Exception:  # noqa: BLE001
            return {"error": "bad photo"}
        if len(jpeg) > upload.MAX_BYTES or jpeg[:3] != b"\xff\xd8\xff" or not (upload.MIN_SIDE <= min(size) and max(size) <= upload.MAX_SIDE):
            return {"error": "the photo size is not allowed"}
        return {"id": suggest_job.spawn(jpeg).object_id}

    @app.function(image=web_image, secrets=upload_secrets)
    @modal.fastapi_endpoint(method="POST")
    def warm(item: dict):
        """{token, which: 'mask'|'lift'} -> {ok: true} at once: starts that GPU container so its model is loaded, and never waits for it (CC-133)."""
        if not _check_token(item.get("token")):
            return {"ok": False, "error": "not allowed"}
        which = item.get("which")
        if which == "mask":
            Mask().ping.spawn()
        elif which == "lift":
            Lift().ping.spawn()
        else:
            return {"ok": False, "error": "bad"}
        return {"ok": True}

    @app.function(image=web_image, secrets=upload_secrets)
    @modal.fastapi_endpoint(method="POST")
    def suggest_status(item: dict):
        """{token, id} -> {state: running} | {state: done, items: [... cutout base64], privacy, seconds} | {state: failed, reason}."""
        import base64
        from modal.functions import FunctionCall
        if not _check_token(item.get("token")):
            return {"state": "failed", "reason": "not allowed"}
        try:
            out = FunctionCall.from_id(str(item.get("id") or "")).get(timeout=0)
        except TimeoutError:
            return {"state": "running", **_stage_of(str(item.get("id") or ""))}
        except Exception as e:  # noqa: BLE001
            return {"state": "failed", "reason": f"the search stopped ({type(e).__name__})"}
        items = [{**i, "cutout": base64.b64encode(i["cutout"]).decode()} for i in out["items"]]
        return {"state": "done", "items": items, "privacy": out["privacy"], "seconds": round(out["seconds"], 1)}

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
    def main(exp: str = "data/eval/cc-38-photo-to-3d", rnd: str = "r1", only: str = "", grow: int = 0, k: int = 4, budget_usd: float = 4.0,
             pad: float = 0.0, texture: bool = False, padretry: bool = True):
        from ccpipe import padretry as padretry_mod  # CC-170 (local side only: the lift image does not carry ccpipe)
        photos = _photos(exp, only)
        out_root = f"{exp}/{rnd}"
        os.makedirs(out_root, exist_ok=True)
        from ccpipe import calls
        mask_w, lift_w = Mask(), Lift()
        gpu = {"l4_seconds": 0.0, "l40s_seconds": 0.0}
        per, loads_l4, loads_l40 = [], 0.0, 0.0
        ledger_path = f"{out_root}/calls.json"  # CC-221: call ids on disk; run this command again after a dropped link and it resumes
        ledger = calls.load_ledger(ledger_path)
        todo = []
        for p in photos:
            d = f"{out_root}/{p['photo']}"
            os.makedirs(d, exist_ok=True)
            if os.path.exists(f"{d}/entry.json"):
                per.append(json.load(open(f"{d}/entry.json")))
            else:
                todo.append(p)
        for p in todo:  # 1. send every mask job
            jpeg = open(f"{exp}/inputs/{p['photo']}.jpg", "rb").read()
            calls.spawn_once(ledger, ledger_path, p["photo"], "mask", lambda: mask_w.run.spawn(jpeg, p["label"], p["box"]))
        for p in todo:  # 2. as each mask comes back, send its lift job
            d = f"{out_root}/{p['photo']}"
            if not os.path.exists(f"{d}/mask_meta.json"):
                m = calls.wait(lambda: modal.FunctionCall.from_id(ledger[p["photo"]]["mask"]).get(timeout=20), p["photo"] + " mask")
                mask_png = _grow_png(m["mask_png"], grow) if grow else m["mask_png"]
                lift_jpeg, lift_mask = m["masked_jpeg"], mask_png
                retry = {"enabled": padretry, "border": padretry_mod.border_contact(_mask_bool(mask_png)), "padded": False}
                retry["touches"] = padretry_mod.touches_border(_mask_bool(mask_png))
                if pad:  # context round: the lift sees the photo on a larger canvas
                    lift_jpeg, lift_mask = _pad_inputs(lift_jpeg, lift_mask, pad)
                    open(f"{d}/lift_input.jpg", "wb").write(lift_jpeg)
                elif padretry and retry["touches"]:  # CC-170: pad and lift, never reject
                    lift_jpeg, lift_mask = padretry_mod.pad_bytes(lift_jpeg, lift_mask)
                    open(f"{d}/lift_input.jpg", "wb").write(lift_jpeg)
                    retry["padded"] = True
                open(f"{d}/masked.jpg", "wb").write(m["masked_jpeg"])
                open(f"{d}/mask.png", "wb").write(mask_png)
                json.dump({"privacy": m["privacy"], "mask": m["mask"]}, open(f"{d}/privacy.json", "w"), indent=2)
                calls.spawn_once(ledger, ledger_path, p["photo"], "lift", lambda: lift_w.run.spawn(lift_jpeg, lift_mask, SEED))
                json.dump({"mask_seconds": m["seconds"], "load_seconds": m["load_seconds"], "mask": m["mask"], "privacy": m["privacy"],
                           "retry": retry, "t0": time.time()}, open(f"{d}/mask_meta.json", "w"), indent=2)
        for p in todo:  # 3. collect the lifts
            d = f"{out_root}/{p['photo']}"
            meta = json.load(open(f"{d}/mask_meta.json"))
            r = calls.wait(lambda: modal.FunctionCall.from_id(ledger[p["photo"]]["lift"]).get(timeout=20), p["photo"] + " lift")
            retry = meta["retry"]
            mask_png = open(f"{d}/mask.png", "rb").read()
            retry.update(padretry_mod.lift_check(r["npz"], mask_png))
            retry["note"] = padretry_mod.decide(retry["touches"], retry["padded"], retry["bad"])
            open(f"{d}/raw.npz", "wb").write(r["npz"])
            gpu["l4_seconds"] += meta["mask_seconds"]
            gpu["l40s_seconds"] += r["seconds"]
            loads_l4, loads_l40 = max(loads_l4, meta["load_seconds"]), max(loads_l40, r["load_seconds"])
            per.append({"photo": p["photo"], "mask_seconds": round(meta["mask_seconds"], 1), "lift_seconds": round(r["seconds"], 1),
                        "wall_seconds": round(time.time() - meta["t0"], 1), "mask": meta["mask"], "privacy": meta["privacy"],
                        "n_faces_raw": r["n_faces"], "n_gaussians": r["n_gaussians"], "padretry": retry})
            print(json.dumps(per[-1]))
            json.dump(per[-1], open(f"{d}/entry.json", "w"), indent=2)
        m = {"load_seconds": loads_l4}
        r = {"load_seconds": loads_l40}
        loads = {"mask_load_seconds": round(m["load_seconds"], 1), "lift_load_seconds": round(r["load_seconds"], 1)}
        run = {"experiment": "cc-38-photo-to-3d", "round": rnd, "issue": "CC-38", "date": time.strftime("%Y-%m-%d"), "seed": SEED,
               "settings": {"mask_grow_px": grow, "colour_k": k, "pad_fraction": pad, "padretry": padretry, "texture": texture}, "photos": per, **loads,
               "gpu_seconds": {"l4": round(gpu["l4_seconds"] + m["load_seconds"]), "l40s": round(gpu["l40s_seconds"] + r["load_seconds"])},
               "gpu_minutes": round((gpu["l4_seconds"] + gpu["l40s_seconds"] + m["load_seconds"] + r["load_seconds"]) / 60, 1),
               "estimated_usd": round(_usd(gpu, m["load_seconds"], r["load_seconds"]), 3),
               "price_basis": "L40S $1.95/h, L4 $0.80/h, container seconds in methods plus one model load each; idle scale-down time not included"}
        json.dump(run, open(f"{out_root}/run.json", "w"), indent=2)
        bake_round(exp, rnd, only, k=k, texture=texture)


def _retry(call, tries=4):
    """A call that waits for a cold container can lose its connection on a slow link; the container keeps starting, so ask again."""
    for i in range(tries):
        try:
            return call()
        except Exception as e:  # noqa: BLE001 (any dropped stream)
            print(f"call failed ({type(e).__name__}); try {i + 1} of {tries}")
            if i == tries - 1:
                raise
            time.sleep(15)


def _mask_bool(png):
    import numpy as np
    from PIL import Image
    return np.asarray(Image.open(io.BytesIO(png)).convert("L")) > 127


def _usd(gpu, l4_load, l40_load):
    return (gpu["l4_seconds"] + l4_load) * L4_PER_SECOND + (gpu["l40s_seconds"] + l40_load) * L40S_PER_SECOND


def _photos(exp, only):
    ps = json.load(open(f"{exp}/photos.json"))
    keep = [s for s in only.split(",") if s]
    return [p for p in ps if not keep or p["photo"] in keep]


def _pad_inputs(jpeg, mask_png, frac):
    """Paste the photo (edge pixels repeated) and its mask (zeros) onto a canvas 1 + 2 * frac times as large."""
    import numpy as np
    from PIL import Image
    img = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"))
    m = np.asarray(Image.open(io.BytesIO(mask_png)).convert("L"))
    py, px = round(img.shape[0] * frac), round(img.shape[1] * frac)
    bi, bm = io.BytesIO(), io.BytesIO()
    Image.fromarray(np.pad(img, ((py, py), (px, px), (0, 0)), mode="edge")).save(bi, "JPEG", quality=95)
    Image.fromarray(np.pad(m, ((py, py), (px, px)), mode="constant")).save(bm, "PNG")
    return bi.getvalue(), bm.getvalue()


def _grow_png(png, px):
    import numpy as np
    from PIL import Image
    from ccpipe import privacy
    m = np.asarray(Image.open(io.BytesIO(png)).convert("L")) > 127
    b = io.BytesIO()
    Image.fromarray((privacy.grow(m, px).astype("uint8") * 255)).save(b, "PNG")
    return b.getvalue()


def bake_round(exp, rnd, only="", k=4, texture=False, raw_from=None, size=1024):
    """The CPU part: raw lift -> GLB, mesh.json and the contact sheet, for each photo that has a raw.npz.

    `raw_from` names an earlier round whose lifts (and masks) are re-used, so a bake-only change costs no GPU."""
    import numpy as np
    from ccpipe import glb, objbake, objsheet
    rows = []
    for p in _photos(exp, only):
        d = f"{exp}/{rnd}/{p['photo']}"
        src = f"{exp}/{raw_from or rnd}/{p['photo']}"
        if not os.path.exists(f"{src}/raw.npz"):  # big files live outside git: <assets>/cc-38-raw/<round>/<photo>/
            src = f"{os.environ.get('CC_ASSETS_DIR', os.path.join(HERE, '..', '..', 'conquercourse-assets'))}/cc-38-raw/{raw_from or rnd}/{p['photo']}"
        if not os.path.exists(f"{src}/raw.npz"):
            continue
        os.makedirs(d, exist_ok=True)
        t0 = time.time()
        raw = np.load(f"{src}/raw.npz")
        args = (raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], p["label"], p.get("height_m"))
        if texture:
            v, f, uv, tex, info = objbake.bake_textured(*args, k=k, texture_size=size)
            col = None
        else:
            v, f, col, info = objbake.bake(*args, k=k)
            uv = tex = None
        out = f"{d}/mesh.glb"
        nbytes = glb.write_glb(out, v, f, col, name=p["photo"], uv=uv, texture=tex)
        info.update(photo=p["photo"], box=p["box"], bytes=nbytes, model="SAM 3D Objects (seed 42)", bake_seconds=round(time.time() - t0, 2),
                    raw_faces=int(len(raw["faces"])), splat_points=int(len(raw["splat_xyz"])), lift_round=raw_from or rnd)
        json.dump(info, open(f"{d}/mesh.json", "w"), indent=2)
        mask = f"{exp}/{raw_from or rnd}/{p['photo']}/mask.png"
        objsheet.sheet(f"{exp}/inputs/{p['photo']}.jpg", p["box"], mask, v, f, col, f"{d}/sheet.png",
                       title=f"{p['photo']}: {p['label']}, {info['height_m']} m ({info['scale_source']})", uv=uv, tex=tex)
        rows.append(info)
        print(p["photo"], info["faces"], "faces", nbytes, "bytes", info["height_m"], "m tilt", info["tilt_deg"], f"{info['bake_seconds']}s")
    return rows


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["bake"])
    ap.add_argument("--exp", default="data/eval/cc-38-photo-to-3d")
    ap.add_argument("--round", default="r1")
    ap.add_argument("--only", default="")
    ap.add_argument("--k", type=int, default=4)
    ap.add_argument("--texture", action="store_true", help="bake the colour into a UV texture instead of vertex colours")
    ap.add_argument("--raw-from", default=None, help="re-use the lifts of this earlier round (no GPU)")
    ap.add_argument("--size", type=int, default=1024)
    a = ap.parse_args()
    bake_round(a.exp, a.round, a.only, a.k, a.texture, a.raw_from, a.size)
