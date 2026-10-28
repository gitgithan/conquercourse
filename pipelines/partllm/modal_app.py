"""Modal app for CC-49: PartLLM (3D part segmentation) on our object GLBs.

Run from a laptop with a Modal token: `modal run pipelines/partllm/modal_app.py --step weights|infer`.
Weights are downloaded once into the `partllm-ckpt` volume. Only meshes go up; only masks and numbers come back.
"""
import json
import pathlib
import subprocess
import time

import modal

APP = "cc-partllm"
CK = "/ck"
REPO = "/opt/PartLLM"
MODEL = f"{CK}/partllm"

app = modal.App(APP)
ck_vol = modal.Volume.from_name("partllm-ckpt", create_if_missing=True)

image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0", "build-essential", "ffmpeg")
    .run_commands(f"git clone --depth 1 https://github.com/czvvd/PartLLM {REPO}")
    .run_commands(f"cd {REPO} && PARTLLM_TORCH_CUDA=cu126 bash scripts/install.sh")
    .pip_install("huggingface_hub", "trimesh")
    .env({"HF_HOME": "/hf"})
)


@app.function(image=image, volumes={CK: ck_vol}, secrets=[modal.Secret.from_name("sam-hf")], timeout=3600)
def fetch_weights():
    from huggingface_hub import snapshot_download

    path = snapshot_download("Czvvd/PartLLM", local_dir=MODEL)
    ck_vol.commit()
    return {"path": path, "files": sorted(str(p.relative_to(MODEL)) for p in pathlib.Path(MODEL).rglob("*") if p.is_file())[:40]}


def _run(cmd, env=None, cwd=REPO):
    import os

    t = time.time()
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env={**os.environ, **(env or {})})
    return {"cmd": cmd, "code": p.returncode, "seconds": round(time.time() - t, 1), "tail": (p.stdout + p.stderr)[-3000:]}


@app.function(image=image, gpu="L4", volumes={CK: ck_vol}, timeout=3600)
def infer(meshes: dict, prompts: list, full_shape: bool = True):
    """meshes: {name: glb bytes}. Returns logs and every output file (masks, coloured meshes) as bytes."""
    root = pathlib.Path("/tmp/work")
    mdir = root / "meshes"
    mdir.mkdir(parents=True, exist_ok=True)
    for n, b in meshes.items():
        (mdir / f"{n}.glb").write_bytes(b)
    env = {"USE_VLLM": "0"}
    logs = []
    for n in meshes:
        out = root / "out" / "text" / n
        logs.append({"mesh": n, "task": "text_guided", **_run(
            ["bash", "scripts/infer.sh", "text_guided", MODEL, str(mdir / f"{n}.glb"), str(out), "--part_names", *prompts], env)})
    if full_shape:
        logs.append({"task": "full_shape", **_run(["bash", "scripts/infer.sh", "full_shape", MODEL, str(mdir), str(root / "out" / "full")], env)})
    files = {}
    for p in (root / "out").rglob("*"):
        if p.is_file() and p.stat().st_size < 20_000_000:
            files[str(p.relative_to(root / "out"))] = p.read_bytes()
    return {"logs": logs, "files": files}


@app.local_entrypoint()
def main(step: str = "weights", prompts: str = "bar,rail,ledge,step", only: str = ""):
    out = pathlib.Path("data/eval/partllm")
    out.mkdir(parents=True, exist_ok=True)
    if step == "weights":
        print(json.dumps(fetch_weights.remote(), indent=2))
        return
    meshes = {p.stem: p.read_bytes() for p in sorted(pathlib.Path("public/assets/objects").glob("*.glb")) if not only or p.stem in only.split(",")}
    t = time.time()
    res = infer.remote(meshes, prompts.split(","), full_shape=not only)
    raw = out / "raw"
    for name, b in res["files"].items():
        (raw / name).parent.mkdir(parents=True, exist_ok=True)
        (raw / name).write_bytes(b)
    (out / "logs.json").write_text(json.dumps({"seconds": round(time.time() - t, 1), "logs": res["logs"]}, indent=2) + "\n")
    print(json.dumps([{k: v for k, v in l.items() if k != "tail"} for l in res["logs"]], indent=2))
