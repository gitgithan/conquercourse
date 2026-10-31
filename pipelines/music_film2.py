"""CC-209, the owner's cut: three MusicGen clips, one per act, each a single 30 s generation (never a continuation: the CC-209 long track failed exactly there, with silent gaps).

Run: modal run pipelines/music_film2.py --out ../conquercourse-assets/eval-full/cc-209-demo-film/music
Model: facebook/musicgen-medium (weights CC BY-NC 4.0, code MIT). Cost: one L4-class GPU for a few minutes, about $1 at most (Modal pay-as-you-go).
Act 1 (Earth to slicer): quiet wonder. Act 2 (editor and courses): a building pulse. Act 3 (the run and the fast beats): driving taiko and strings, two seeds, joined with a crossfade on a bar line.
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"
JOBS = [
    {"name": "act1-wonder", "seed": 11, "prompt": "cinematic wonder, gentle piano arpeggios, soft swelling strings, slow rising awe, 100 bpm, instrumental, no vocals, no drums"},
    {"name": "act2-pulse", "seed": 22, "prompt": "playful building pulse, marimba and pizzicato strings, soft taiko drum, 100 bpm, curious energy rising, instrumental, no vocals"},
    {"name": "act3-drive-a", "seed": 33, "prompt": "epic taiko drums, driving string ostinato, heroic adventure chase, 100 bpm, fast and exciting, instrumental, no vocals"},
    {"name": "act3-drive-b", "seed": 44, "prompt": "epic taiko drums, driving string ostinato, heroic adventure chase, 100 bpm, fast and exciting, instrumental, no vocals"},
]
app = modal.App("cc209-film-music2")
image = (modal.Image.debian_slim(python_version="3.10").pip_install("torch", "transformers>=4.45", "numpy", "scipy", "accelerate").env({"HF_HOME": "/hf-cache"}))
hf_cache = modal.Volume.from_name("hf-cache")


@app.function(image=image, gpu=["L4", "A10G", "L40S"], timeout=1800, volumes={"/hf-cache": hf_cache})
def make() -> dict:
    import numpy as np, torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    proc = AutoProcessor.from_pretrained(MODEL)
    m = MusicgenForConditionalGeneration.from_pretrained(MODEL, torch_dtype=torch.float16).to("cuda")
    sr, fr = m.config.audio_encoder.sampling_rate, m.config.audio_encoder.frame_rate
    out = {}
    for job in JOBS:  # single generations only; the model stays loaded between jobs
        torch.manual_seed(job["seed"])
        inp = proc(text=[job["prompt"]], return_tensors="pt").to("cuda")
        wav = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(30 * fr))[0, 0].float().cpu().numpy()
        out[job["name"]] = wav.astype("float32").tobytes()
    return {"rate": sr, "clips": out}


@app.local_entrypoint()
def main(out: str = "../conquercourse-assets/eval-full/cc-209-demo-film/music"):
    r = make.remote()
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    for name, wav in r["clips"].items():
        (o / f"{name}.f32").write_bytes(wav)
    (o / "film-music2.run.json").write_text(json.dumps({"model": MODEL, "jobs": JOBS, "guidance_scale": 3.0, "method": "four single 30 s generations, no continuations", "rate": r["rate"]}, indent=2) + "\n")
    print("done", list(r["clips"]), "rate", r["rate"])
