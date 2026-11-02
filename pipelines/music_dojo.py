"""CC-132, new Dojo music: five cave options (xylophone, echo, romantic rubato) from MusicGen, text prompt only (no melody input, no artist names).

Why: the old Dojo loop was a track with an unclear licence; the product owner says it is copyrighted, so it must go.
Run: modal run pipelines/music_dojo.py --out ../conquercourse-assets/eval-full/cc-132-dojo-music
Model: facebook/musicgen-medium (weights CC BY-NC 4.0, code MIT). Cost: one L4-class GPU for a few minutes, about $1 (Modal pay-as-you-go).
Each option is one single 30 s generation (never a continuation).
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"
JOBS = [
    {"name": "cave-a-xylo-echo", "seed": 611, "prompt": "light xylophone and celesta playing a slow dreamy melody with long echo and reverb, free flowing rubato tempo, romantic era expressive phrasing, soft ambient cave atmosphere with distant water drips and wide surround pad, instrumental, no drums"},
    {"name": "cave-b-marimba-pad", "seed": 622, "prompt": "gentle marimba and glockenspiel, expressive romantic rubato, notes that stretch and hurry, big cavernous echo, deep warm ambient drone underneath, magical underground cave, wonder and calm, instrumental, no drums"},
    {"name": "cave-c-xylo-romantic", "seed": 633, "prompt": "xylophone playing a tender romantic melody with varied rhythm, swelling and fading dynamics like a Chopin nocturne, shimmering echo, glassy ambient pad, spacious crystal cave, slow, instrumental, no drums"},
    {"name": "cave-d-vibes-celesta", "seed": 644, "prompt": "vibraphone and celesta, light bell-like xylophone tones, flexible tempo with pauses and gentle accelerations, long reverb tails, soft choir-like pad far away, glowing cave walking atmosphere, instrumental, no drums"},
    {"name": "cave-e-kalimba-harp", "seed": 655, "prompt": "kalimba and soft harp with light xylophone accents, romantic expressive timing, echoing in a large stone cave, subtle wind and dripping water ambience, warm slow pad, magical and peaceful, instrumental, no drums"},
]
app = modal.App("cc132-dojo-music2")
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
        wav = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(30 * fr))[0, 0].float().cpu().numpy()
        out[job["name"]] = wav.astype("float32").tobytes()
    return {"rate": sr, "clips": out}


@app.local_entrypoint()
def main(out: str = "../conquercourse-assets/eval-full/cc-132-dojo-music2"):
    r = make.remote()
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    for name, wav in r["clips"].items():
        (o / f"{name}.f32").write_bytes(wav)
    (o / "run.json").write_text(json.dumps({"model": MODEL, "jobs": JOBS, "guidance_scale": 3.0, "method": "five single 30 s generations, no continuations", "rate": r["rate"]}, indent=2) + "\n")
    print("done", list(r["clips"]), "rate", r["rate"])
