"""CC-55: TRELLIS.2 and Pixal3D on the six park crops (Modal, one L40S at a time).

usage:
  modal run pipelines/objbake/modal_app.py::check_imports              # CPU only: does the image build and import?
  modal run pipelines/objbake/modal_app.py --model trellis2            # GPU: six crops -> GLBs in data/eval/object-bakeoff/outputs/
  modal run pipelines/objbake/modal_app.py --model pixal3d
Inputs are RGBA cut-outs from data/eval/object-bakeoff/inputs/ (a SAM 3 mask as alpha, so no background-removal model
is needed: RMBG-2.0 is gated and non-commercial and stays out).
Weights are downloaded into the Modal volume `objbake-hf` with the existing `sam-hf` secret (a Hugging Face token that
already has the DINOv3 access the product owner requested); nothing is accepted or created here."""
import json
import os
import time

import modal

L40S_PER_SECOND = 1.95 / 3600
HF = "/hf"
TRELLIS_DIR = "/opt/TRELLIS.2"
PIXAL_DIR = "/opt/Pixal3D"

app = modal.App("cc-objbake")
hf_vol = modal.Volume.from_name("objbake-hf", create_if_missing=True)

image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "libjpeg-dev", "libgl1", "libglib2.0-0", "ffmpeg", "ninja-build", "build-essential", "clang", "cmake")
    .pip_install("torch==2.6.0", "torchvision==0.21.0", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("imageio", "imageio-ffmpeg", "tqdm", "easydict", "opencv-python-headless", "ninja", "trimesh", "tensorboard",
                 "pandas", "lpips", "zstandard", "kornia", "timm", "numpy<2", "setuptools<80", "wheel")
    .pip_install("git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8")
    .env({"TORCH_CUDA_ARCH_LIST": "8.9", "MAX_JOBS": "8", "FORCE_CUDA": "1", "CUDA_HOME": "/usr/local/cuda"})
    .run_commands(
        "git clone -b v0.4.0 https://github.com/NVlabs/nvdiffrast.git /tmp/ext/nvdiffrast && pip install /tmp/ext/nvdiffrast --no-build-isolation",
        "git clone -b renderutils https://github.com/JeffreyXiang/nvdiffrec.git /tmp/ext/nvdiffrec && pip install /tmp/ext/nvdiffrec --no-build-isolation",
        "git clone https://github.com/JeffreyXiang/CuMesh.git /tmp/ext/CuMesh --recursive && pip install /tmp/ext/CuMesh --no-build-isolation",
        "git clone https://github.com/JeffreyXiang/FlexGEMM.git /tmp/ext/FlexGEMM --recursive && pip install /tmp/ext/FlexGEMM --no-build-isolation",
        f"git clone -b main https://github.com/microsoft/TRELLIS.2.git {TRELLIS_DIR} --recursive && pip install {TRELLIS_DIR}/o-voxel --no-build-isolation",
        f"git clone https://github.com/TencentARC/Pixal3D {PIXAL_DIR}",
        f"sed -i '/^trimesh==/d' {PIXAL_DIR}/requirements.txt && pip install -r {PIXAL_DIR}/requirements.txt 'trimesh>=4.11'",
        "NATTEN_CUDA_ARCH=8.9 NATTEN_N_WORKERS=8 pip install natten==0.21.0 --no-build-isolation",
        "pip install https://github.com/LDYang694/Storages/releases/download/20260430/utils3d-0.0.2-py3-none-any.whl || true",
    )
    .pip_install("xformers==0.0.29.post2", index_url="https://download.pytorch.org/whl/cu124")
    .pip_install("einops")
    .env({"HF_HOME": HF, "ATTN_BACKEND": "xformers", "OPENCV_IO_ENABLE_OPENEXR": "1", "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True"})
)
secrets = [modal.Secret.from_name("sam-hf")]


@app.function(image=image, secrets=secrets, timeout=900)
def check_imports_remote():
    import subprocess
    import sys

    out = {}
    for mod, path in [("trellis2.pipelines", TRELLIS_DIR), ("o_voxel", None), ("nvdiffrast.torch", None), ("cumesh", None), ("flex_gemm", None),
                      ("pixal3d.pipelines", PIXAL_DIR), ("natten", None), ("moge.model.v2", None)]:
        code = f"import sys; sys.path.insert(0, {path!r}) if {path!r} else None; import {mod}; print('ok')"
        r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        out[mod] = "ok" if r.returncode == 0 else r.stderr.strip().splitlines()[-1][:200]
    return out


@app.local_entrypoint()
def check_imports():
    print(json.dumps(check_imports_remote.remote(), indent=1))


def _no_rembg(package):
    """Both pipelines build briaai/RMBG-2.0 (gated, non-commercial) when they load. Our crops already carry an alpha
    (a SAM 3 mask, or a fully opaque plain crop), so a stand-in that returns the image keeps that model out."""
    import importlib

    class NoRembg:
        def __init__(self, *a, **k):
            pass

        def to(self, *a, **k):
            return self

        def cpu(self):
            return self

        def cuda(self):
            return self

        def __call__(self, img):
            return img.convert("RGBA")

    mod = importlib.import_module(f"{package}.pipelines.rembg")
    mod.BiRefNet = NoRembg


def _run_trellis(items):
    import sys

    sys.path.insert(0, TRELLIS_DIR)
    import torch
    from PIL import Image
    from trellis2.pipelines import Trellis2ImageTo3DPipeline
    import o_voxel

    _no_rembg("trellis2")

    t0 = time.perf_counter()
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    pipeline.cuda()
    load_s = time.perf_counter() - t0
    out = {"load_seconds": round(load_s, 1), "objects": {}}
    for name, png in items.items():
        import io
        t1 = time.perf_counter()
        img = Image.open(io.BytesIO(png))
        mesh = pipeline.run(img)[0]
        mesh.simplify(16777216)
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices, faces=mesh.faces, attr_volume=mesh.attrs, coords=mesh.coords, attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size, aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=100000, texture_size=1024, remesh=True, remesh_band=1, remesh_project=0, verbose=False)
        path = f"/tmp/{name}.glb"
        glb.export(path, extension_webp=False)
        out["objects"][name] = {"glb": open(path, "rb").read(), "seconds": round(time.perf_counter() - t1, 1)}
        torch.cuda.empty_cache()
    return out


def _run_pixal(items):
    import io
    import sys

    sys.path.insert(0, PIXAL_DIR)
    os.chdir(PIXAL_DIR)
    import inference as px
    from PIL import Image

    _no_rembg("pixal3d")
    import o_voxel

    # inference.py exports every mesh at 1,000,000 faces and a 4096 texture, which stalls the UV step; use the same export as the
    # TRELLIS.2 run (100,000 faces, 1024 texture), and load the pipeline once instead of once per image.
    to_glb = o_voxel.postprocess.to_glb

    def small_glb(*a, **k):
        k.update(decimation_target=100000, texture_size=1024)
        return to_glb(*a, **k)

    o_voxel.postprocess.to_glb = small_glb
    init_pipeline, cache = px.init_pipeline, {}

    def init_once(*a, **k):
        if "p" not in cache:
            cache["p"] = init_pipeline(*a, **k)
        return cache["p"]

    px.init_pipeline = init_once

    out = {"load_seconds": None, "objects": {}}
    for name, png in items.items():
        t1 = time.perf_counter()
        src, dst = f"/tmp/{name}.png", f"/tmp/{name}.glb"
        Image.open(io.BytesIO(png)).save(src)
        px.run_inference(src, dst, seed=42, low_vram=False)
        out["objects"][name] = {"glb": open(dst, "rb").read(), "seconds": round(time.perf_counter() - t1, 1)}
    return out


@app.function(image=image, secrets=secrets, volumes={HF: hf_vol}, gpu="L40S", timeout=3000, max_containers=1)
def run_model(model: str, items: dict):
    t0 = time.perf_counter()
    res = _run_trellis(items) if model == "trellis2" else _run_pixal(items)
    res["container_seconds"] = round(time.perf_counter() - t0, 1)
    hf_vol.commit()
    return res


@app.local_entrypoint()
def main(model: str = "trellis2", only: str = ""):
    here = "data/eval/object-bakeoff"
    names = [n for n in json.load(open("public/assets/objects/index.json"))["objects"]]
    items = {o["name"]: open(f"{here}/inputs/{o['name']}.png", "rb").read() for o in names if not only or o["name"] in only.split(",")}
    res = run_model.remote(model, items)
    os.makedirs(f"{here}/outputs", exist_ok=True)
    meta = {"model": model, "load_seconds": res["load_seconds"], "container_seconds": res["container_seconds"],
            "usd_estimate": round(res["container_seconds"] * L40S_PER_SECOND, 3), "objects": {}}
    for n, r in res["objects"].items():
        open(f"{here}/outputs/{model}-{n}.glb", "wb").write(r["glb"])
        meta["objects"][n] = {"seconds": r["seconds"], "bytes": len(r["glb"])}
    json.dump(meta, open(f"{here}/outputs/{model}.json", "w"), indent=2)
    print(json.dumps(meta, indent=1))
