"""CC-133 promo: three MusicGen options for the Grand Entrance (a fast run that stops at a gate), each one 15 s generation.

Run: modal run pipelines/music_entrance.py --out ../conquercourse-assets/promo-v2b/music-entrance
Model: facebook/musicgen-medium (weights CC BY-NC 4.0, code MIT). Cost: one small GPU for a few minutes, about $0.5 at most (Modal pay-as-you-go).
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"
JOBS = [
    {"name": "entrance-a-taiko", "seed": 7, "prompt": "fast driving taiko drums and racing strings, heroic sprint, builds quickly then a big final hit and a short silence like arriving at a gate, 130 bpm, instrumental, no vocals"},
    {"name": "entrance-b-cinematic", "seed": 8, "prompt": "cinematic rising percussion and brass, speed building to a sudden stop with a deep boom and a held shimmering chord, grand arrival, 120 bpm, instrumental, no vocals"},
    {"name": "entrance-c-electro", "seed": 9, "prompt": "energetic electronic pulse with fast arpeggio, accelerating run, ends with a crisp stop hit and a bright resolved chord, sporty and fun, 128 bpm, instrumental, no vocals"},
]
app = modal.App("cc133-entrance-music")
image = (modal.Image.debian_slim(python_version="3.10").pip_install("torch", "transformers>=4.45", "numpy", "scipy", "accelerate").env({"HF_HOME": "/hf-cache"}))
hf_cache = modal.Volume.from_name("hf-cache")


@app.function(image=image, gpu=["L4", "A10G", "L40S"], timeout=1800, volumes={"/hf-cache": hf_cache})
def make() -> dict:
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    proc = AutoProcessor.from_pretrained(MODEL)
    m = MusicgenForConditionalGeneration.from_pretrained(MODEL, torch_dtype=torch.float16).to("cuda")
    sr, fr = m.config.audio_encoder.sampling_rate, m.config.audio_encoder.frame_rate
    out = {}
    for job in JOBS:
        torch.manual_seed(job["seed"])
        inp = proc(text=[job["prompt"]], return_tensors="pt").to("cuda")
        wav = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(15 * fr))[0, 0].float().cpu().numpy()
        out[job["name"]] = wav.astype("float32").tobytes()
    return {"rate": sr, "clips": out}


@app.local_entrypoint()
def main(out: str = "../conquercourse-assets/promo-v2b/music-entrance"):
    r = make.remote()
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    for name, wav in r["clips"].items():
        (o / f"{name}.f32").write_bytes(wav)
    (o / "run.json").write_text(json.dumps({"model": MODEL, "jobs": JOBS, "guidance_scale": 3.0, "rate": r["rate"]}, indent=2) + "\n")
    print("done", list(r["clips"]), "rate", r["rate"])
