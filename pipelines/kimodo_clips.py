"""Kimodo text-to-motion on Modal (one L4), for starter clips CMU does not cover. docs/pipelines.md, pipeline 3.

Run (detached, with a log):  modal run --detach pipelines/kimodo_clips.py --out data/eval/starter-clips/outputs/kimodo
Writes one JSON per prompt and run.json pieces; the 30-joint frames are read from the model's positions.
The Hugging Face token comes from the Modal secret `sam-hf`, never from the repo."""
import json
import os
import time

import modal

KIMODO_COMMIT = "e1c219c99b4b94ba48be1fb6a1cbc64ecee4c954"
MODEL = "kimodo-soma-rp"
STEPS = 100
SEED = 7

app = modal.App("cc17-kimodo-clips")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "cmake", "build-essential", "libeigen3-dev", "pybind11-dev")
    .pip_install("torch", "numpy")
    .pip_install(f"git+https://github.com/nv-tlabs/kimodo.git@{KIMODO_COMMIT}")
    .env({"TEXT_ENCODER_MODE": "local", "HF_HOME": "/hf-cache"})
)
hf_cache = modal.Volume.from_name("hf-cache")

# name -> (prompt, seconds); variants a/b/c of the same move are pooled by pipelines/build_starter.py
PROMPTS = {
    "leap_a": ("A person sprints and leaps far forward through the air, then lands on both feet.", 4.0),
    "leap_b": ("A person takes a running start and does a long jump, flying with both feet off the ground, then lands.", 4.0),
    "wall_a": ("A person sprints at a wall, runs up it with two quick steps and reaches high to grab the top edge.", 5.0),
    "wall_b": ("A person runs toward a wall, plants a foot high on the wall to push up, and catches the top ledge with both hands.", 5.0),
    "wall_c": ("A parkour runner does a wall run: sprints, steps up the wall with one foot, then grabs the ledge with both hands and hangs.", 5.0),
    # round 2 (one change: 3 s instead of 5 s, so there is less time to climb to the top of the wall)
    "wall_a3": ("A person sprints at a wall, runs up it with two quick steps and reaches high to grab the top edge.", 3.0),
    "wall_b3": ("A person runs toward a wall, plants a foot high on the wall to push up, and catches the top ledge with both hands.", 3.0),
    "wall_c3": ("A parkour runner does a wall run: sprints, steps up the wall with one foot, then grabs the ledge with both hands and hangs.", 3.0),
    "grab_a": ("A person jumps up and grabs an overhead bar with both hands, then hangs from it.", 4.0),
    "grab_b": ("A person jumps and catches a high ledge with both hands and hangs there with straight arms.", 4.0),
}


@app.function(image=image, gpu="L4", timeout=1800, secrets=[modal.Secret.from_name("sam-hf")],
              volumes={"/hf-cache": hf_cache})
def generate(prompts: dict, samples: int):
    import numpy as np
    import torch

    for name in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"):  # whichever the secret provides, under the name the library reads
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
    sl = model.skeleton.get_skel_slice(SOMASkeleton77())
    out = {"model": resolved, "kimodo_commit": KIMODO_COMMIT, "steps": STEPS, "seed": SEED,
           "torch": str(torch.__version__), "load_s": round(load_s, 1), "clips": {}}
    for name, (text, seconds) in prompts.items():
        t1 = time.time()
        runs = []
        for k in range(samples):  # one seed per sample (a list prompt with num_samples gives one motion)
            seed_everything(SEED + k)
            res = model(text, int(round(seconds * model.fps)), num_denoising_steps=STEPS, num_samples=1,
                        post_processing=True, return_numpy=True)
            runs.append(np.asarray(res["posed_joints"])[0][:, sl, :])  # (T, 30, 3) from the 77-joint output
        out["clips"][name] = {"prompt": text, "seconds": seconds, "fps": float(model.fps), "gen_s": round(time.time() - t1, 1),
                              "seeds": [SEED + k for k in range(samples)], "samples": np.round(np.stack(runs), 4).tolist()}
    out["total_s"] = round(time.time() - t0, 1)
    return out


@app.local_entrypoint()
def main(out: str = "data/eval/starter-clips/outputs/kimodo", samples: int = 6, only: str = "", prompts_file: str = ""):
    os.makedirs(out, exist_ok=True)
    t = time.time()
    table = PROMPTS
    if prompts_file:  # {name: [prompt, seconds]}, written by pipelines/motion_on_demand.py for a new move
        with open(prompts_file) as f:
            table = {k: (v[0], float(v[1])) for k, v in json.load(f).items()}
    chosen = {k: v for k, v in table.items() if not only or k in only.split(",")}
    res = generate.remote(chosen, samples)
    for name, c in res["clips"].items():
        with open(os.path.join(out, f"{name}.json"), "w") as f:
            json.dump(c, f)
    meta = {k: v for k, v in res.items() if k != "clips"}
    meta["wall_s"] = round(time.time() - t, 1)
    with open(os.path.join(out, "kimodo_run.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta))
