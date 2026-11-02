"""CC-132, new Dojo music: five gentle options from MusicGen, text prompt only (no melody input, no artist names).

Why: the old Dojo loop was a track with an unclear licence; the product owner says it is copyrighted, so it must go.
Run: modal run pipelines/music_dojo.py --out ../conquercourse-assets/eval-full/cc-132-dojo-music
Model: facebook/musicgen-medium (weights CC BY-NC 4.0, code MIT). Cost: one L4-class GPU for a few minutes, about $1 (Modal pay-as-you-go).
Each option is one single 30 s generation (never a continuation).
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"
JOBS = [
    {"name": "dojo-a-piano-slow", "seed": 101, "prompt": "calm solo piano, slow gentle melody, soft and warm, spacious, relaxing study music, 60 bpm, instrumental, no vocals, no drums"},
    {"name": "dojo-b-piano-strings", "seed": 202, "prompt": "gentle piano with a soft string pad, peaceful and tender, slow flowing arpeggios, calm morning, 66 bpm, instrumental, no vocals, no drums"},
    {"name": "dojo-c-music-box", "seed": 303, "prompt": "soft music box and felt piano, quiet lullaby feel, simple sweet melody, dreamy and calm, 72 bpm, instrumental, no vocals, no drums"},
    {"name": "dojo-d-guitar", "seed": 404, "prompt": "fingerpicked nylon guitar, soft and peaceful, slow warm melody, gentle room sound, relaxing, 70 bpm, instrumental, no vocals, no drums"},
    {"name": "dojo-e-harp-piano", "seed": 505, "prompt": "soft harp and piano, quiet garden at dawn, slow gentle phrases, airy and calm, 64 bpm, instrumental, no vocals, no drums"},
]
app = modal.App("cc132-dojo-music")
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
def main(out: str = "../conquercourse-assets/eval-full/cc-132-dojo-music"):
    r = make.remote()
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    for name, wav in r["clips"].items():
        (o / f"{name}.f32").write_bytes(wav)
    (o / "run.json").write_text(json.dumps({"model": MODEL, "jobs": JOBS, "guidance_scale": 3.0, "method": "five single 30 s generations, no continuations", "rate": r["rate"]}, indent=2) + "\n")
    print("done", list(r["clips"]), "rate", r["rate"])
