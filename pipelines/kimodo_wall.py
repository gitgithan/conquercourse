"""Kimodo on the simulator's wall path (CC-17, docs/pipelines.md pipeline 3), on Modal (one L4).

Per seed: a text-only motion is the pose source; its body is moved so the hips ride the simulator's hips path
(data/eval/cc-17-wall/inputs/targets.json); the constraints are the root path on every frame, the hips (position, height,
heading) every 2nd frame, and the planted feet, gripping hands and deck feet on their frames. The baseline (the text-only
motion before it was moved) comes back with each sample so the effect of the targets can be read against it.

Run (detached, with a log):
  modal run --detach pipelines/kimodo_wall.py --targets data/eval/cc-17-wall/inputs/targets.json --out <dir> --round 1
Dry run on CPU (builds the constraints from a fake body, no GPU, no weights):
  modal run pipelines/kimodo_wall.py --targets <targets.json> --dry-run
The Hugging Face token comes from the Modal secret `sam-hf`, never from the repo."""
import json
import os
import time

import modal

KIMODO_COMMIT = "e1c219c99b4b94ba48be1fb6a1cbc64ecee4c954"
MODEL = "kimodo-soma-rp"
STEPS = 100
PROMPT = "A person sprints at a curved wall, runs up it, reaches up with both hands and grabs the top edge, then pulls up onto the top."

app = modal.App("cc17-kimodo-wall")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "cmake", "build-essential", "libeigen3-dev", "pybind11-dev")
    .pip_install("torch", "numpy")
    .pip_install(f"git+https://github.com/nv-tlabs/kimodo.git@{KIMODO_COMMIT}")
    .env({"TEXT_ENCODER_MODE": "local", "HF_HOME": "/hf-cache"})
)
hf_cache = modal.Volume.from_name("hf-cache")


def build_constraints(skel, targets, src_pos, src_rot, cfg):
    """Constraint sets built on the CPU (a constraint built on the GPU lost its joint indices once).

    src_pos (T, J, 3) and src_rot (T, J, 3, 3) are the pose source already moved onto the hips path."""
    import torch
    from kimodo.constraints import (EndEffectorConstraintSet, LeftFootConstraintSet, LeftHandConstraintSet,
                                    RightFootConstraintSet, RightHandConstraintSet, Root2DConstraintSet)

    T = src_pos.shape[0]
    hips = torch.tensor(targets["hips"], dtype=torch.float32)
    root2d = hips[:, [0, 2]]
    sets = [Root2DConstraintSet(skel, torch.arange(T), root2d)]
    every = cfg.get("hips_every", 2)
    hf = torch.arange(0, T, every)
    sets.append(EndEffectorConstraintSet(skel, hf, src_pos[hf], src_rot[hf], root2d[hf], joint_names=["Hips"]))
    chains = {"LeftFoot": (LeftFootConstraintSet, skel.left_foot_joint_names), "RightFoot": (RightFootConstraintSet, skel.right_foot_joint_names),
              "LeftHand": (LeftHandConstraintSet, skel.left_hand_joint_names), "RightHand": (RightHandConstraintSet, skel.right_hand_joint_names)}
    pins = []
    for group in ("plants", "grips", "deck"):
        if group in cfg.get("skip", []):
            continue
        pins += targets[group]
    for pin in pins:
        cls, chain = chains[pin["joint"]]
        a, b = pin["frames"]
        fr = torch.arange(a, b + 1)
        P = src_pos[fr].clone()
        ids = [skel.bone_index[n] for n in chain]
        delta = torch.tensor(pin["point"], dtype=torch.float32) - P[:, ids[0]]
        P[:, ids] += delta[:, None, :]
        sets.append(cls(skel, fr, P, src_rot[fr], root2d[fr]))
    return sets


@app.function(image=image, gpu="L4", timeout=3000, secrets=[modal.Secret.from_name("sam-hf")], volumes={"/hf-cache": hf_cache})
def generate(targets: dict, seeds: list, cfg: dict):
    import numpy as np
    import torch

    for name in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"):
        if name not in os.environ:
            for other in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_TOKEN"):
                if other in os.environ:
                    os.environ[name] = os.environ[other]
    from kimodo import load_model
    from kimodo.skeleton import SOMASkeleton77
    from kimodo.tools import seed_everything

    t0 = time.time()
    model, resolved = load_model(MODEL, device="cuda:0", default_family="Kimodo", return_resolved_name=True)
    load_s = time.time() - t0
    skel = model.skeleton
    sl = skel.get_skel_slice(SOMASkeleton77())
    T = targets["frames"]
    prompt = cfg.get("prompt", targets.get("prompt", PROMPT))
    out = {"model": resolved, "kimodo_commit": KIMODO_COMMIT, "steps": STEPS, "torch": str(torch.__version__), "load_s": round(load_s, 1),
           "bone_order_names": list(skel.bone_order_names), "config": cfg, "samples": []}
    hips = torch.tensor(targets["hips"], dtype=torch.float32)
    for seed in seeds:
        t1 = time.time()
        seed_everything(seed)
        src = model(prompt, T, num_denoising_steps=STEPS, num_samples=1, post_processing=True, return_numpy=False)
        src_pos = src["posed_joints"][0][:, sl].float().cpu()
        src_rot = src["global_rot_mats"][0][:, sl].float().cpu()
        moved = src_pos + (hips - src_pos[:, skel.root_idx])[:, None, :]          # the body moved onto the hips path, pose unchanged
        cons = build_constraints(skel, targets, moved, src_rot, cfg)
        cons = [c.to("cuda:0") for c in cons]
        seed_everything(seed)
        extra = {"cfg_weight": cfg["cfg_weight"]} if "cfg_weight" in cfg else {}
        res = model(prompt, T, num_denoising_steps=STEPS, num_samples=1, constraint_lst=cons, post_processing=True, return_numpy=True, **extra)
        out["samples"].append({"seed": seed, "gen_s": round(time.time() - t1, 1),
                               "baseline": np.round(src_pos.numpy(), 4).tolist(),
                               "moved_source": np.round(moved.numpy(), 4).tolist(),
                               "sample": np.round(np.asarray(res["posed_joints"])[0][:, sl, :], 4).tolist()})
    out["total_s"] = round(time.time() - t0, 1)
    return out


@app.function(image=image, timeout=900)
def dry_run(targets: dict, cfg: dict):
    """CPU only: build every constraint from a fake upright body and check the shapes."""
    import torch
    from kimodo.skeleton import SOMASkeleton30

    skel = SOMASkeleton30()
    J = skel.nbjoints
    T = targets["frames"]
    pos = torch.zeros(T, J, 3)
    pos[:, :, 1] = 1.0
    rot = torch.eye(3).expand(T, J, 3, 3).clone()
    sets = build_constraints(skel, targets, pos, rot, cfg)
    return {"n_joints": J, "bone_order_names": list(skel.bone_order_names), "root_idx": skel.root_idx,
            "constraints": [{"name": c.name, "frames": int(len(c.frame_indices))} for c in sets]}


@app.local_entrypoint()
def main(targets: str, out: str = "", round: int = 1, seeds: str = "7,8,9,10,11,12,13,14", config: str = "{}", dry_run_only: bool = False):
    with open(targets) as f:
        tg = json.load(f)
    cfg = {"round": round, **json.loads(config)}
    if dry_run_only:
        print(json.dumps(dry_run.remote(tg, cfg), indent=1))
        return
    os.makedirs(out, exist_ok=True)
    t = time.time()
    res = generate.remote(tg, [int(s) for s in seeds.split(",")], cfg)
    with open(os.path.join(out, "kimodo_samples.json"), "w") as f:
        json.dump(res, f)
    meta = {k: v for k, v in res.items() if k != "samples"}
    meta["wall_s"] = float(f"{time.time() - t:.1f}")
    meta["gen_s"] = [s["gen_s"] for s in res["samples"]]
    with open(os.path.join(out, "kimodo_run.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta))
