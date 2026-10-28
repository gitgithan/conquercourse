"""CC-54: Kimodo with and without key poses, on Modal (one L4). Run (detached, with a log):
  modal run --detach pipelines/posekimodo/modal_app.py --out data/eval/pose-kimodo/outputs --seeds 7,8,9,10
Per move and seed: a text-only baseline and a sample held to the key poses (FullBodyConstraintSet: positions of the 30 joints; the rotations
are ignored by Kimodo). The Hugging Face token comes from the Modal secret `sam-hf`, never from the repo."""
import json
import os
import sys
import time

import modal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))

KIMODO_COMMIT = "e1c219c99b4b94ba48be1fb6a1cbc64ecee4c954"
MODEL = "kimodo-soma-rp"
STEPS = 100

app = modal.App("cc54-pose-kimodo")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "cmake", "build-essential", "libeigen3-dev", "pybind11-dev")
    .pip_install("torch", "numpy")
    .pip_install(f"git+https://github.com/nv-tlabs/kimodo.git@{KIMODO_COMMIT}")
    .env({"TEXT_ENCODER_MODE": "local", "HF_HOME": "/hf-cache"})
)
hf_cache = modal.Volume.from_name("hf-cache")


@app.function(image=image, gpu="L4", timeout=3000, secrets=[modal.Secret.from_name("sam-hf")], volumes={"/hf-cache": hf_cache})
def generate(moves: dict, seeds: list):
    import numpy as np
    import torch

    for name in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"):
        if name not in os.environ:
            for other in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_TOKEN"):
                if other in os.environ:
                    os.environ[name] = os.environ[other]
    from kimodo import load_model
    from kimodo.constraints import FullBodyConstraintSet
    from kimodo.skeleton import SOMASkeleton77
    from kimodo.tools import seed_everything

    t0 = time.time()
    model, resolved = load_model(MODEL, device="cuda:0", default_family="Kimodo", return_resolved_name=True)
    load_s = time.time() - t0
    skel = model.skeleton
    assert int(model.fps) == 30, model.fps
    sl = skel.get_skel_slice(SOMASkeleton77())
    out = {"model": resolved, "kimodo_commit": KIMODO_COMMIT, "steps": STEPS, "torch": str(torch.__version__), "load_s": round(load_s, 1), "moves": {}}
    for name, mv in moves.items():
        frames = [k[0] for k in mv["keys"]]
        pos = torch.tensor([k[1] for k in mv["keys"]], dtype=torch.float32)  # built on the CPU, moved after
        rot = torch.eye(3).expand(len(frames), skel.nbjoints, 3, 3).clone()  # Kimodo ignores these for a full-body constraint
        item = {"text": mv["text"], "frames": mv["frames"], "key_frames": frames, "samples": []}
        for seed in seeds:
            t1 = time.time()
            seed_everything(seed)
            base = model(mv["text"], mv["frames"], num_denoising_steps=STEPS, num_samples=1, post_processing=True, return_numpy=True)
            cons = [FullBodyConstraintSet(skel, torch.tensor(frames), pos, rot).to("cuda:0")]
            seed_everything(seed)
            cond = model(mv["text"], mv["frames"], num_denoising_steps=STEPS, num_samples=1, constraint_lst=cons, post_processing=True, return_numpy=True)
            item["samples"].append({"seed": seed, "gen_s": round(time.time() - t1, 1),
                                    "baseline": np.round(np.asarray(base["posed_joints"])[0][:, sl, :], 4).tolist(),
                                    "keyed": np.round(np.asarray(cond["posed_joints"])[0][:, sl, :], 4).tolist()})
        out["moves"][name] = item
    out["total_s"] = round(time.time() - t0, 1)
    return out


@app.local_entrypoint()
def main(out: str = "data/eval/pose-kimodo/outputs", seeds: str = "7,8,9,10", only: str = "", round: int = 1):
    import numpy as np
    from spec import moves as make

    mv = {k: {**v, "keys": [(f, np.asarray(p).tolist()) for f, p in v["keys"]]} for k, v in make(round).items() if not only or k in only.split(",")}
    os.makedirs(out, exist_ok=True)
    t = time.time()
    res = generate.remote(mv, [int(s) for s in seeds.split(",")])
    res["round"] = round
    with open(os.path.join(out, "kimodo_samples.json"), "w") as f:
        json.dump(res, f)
    meta = {k: v for k, v in res.items() if k != "moves"}
    meta["wall_s"] = float(f"{time.time() - t:.1f}")
    meta["gen_s"] = {m: [s["gen_s"] for s in v["samples"]] for m, v in res["moves"].items()}
    with open(os.path.join(out, "kimodo_run.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta))
