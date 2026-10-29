"""CC-132: original music loops from text prompts only (AudioCraft MusicGen, no melody input).

Run: modal run --detach pipelines/music_loops.py --out data/eval/cc-132-music/outputs
Weights: facebook/musicgen-medium, CC BY-NC 4.0 (non-commercial); code MIT. See docs/ASSETS.md.
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"  # Meta AudioCraft MusicGen weights via transformers (audiocraft pip build failed on `av`)
SECONDS = 30
app = modal.App("cc132-music")
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install("torch", "transformers>=4.45", "numpy", "scipy", "accelerate")
    .env({"HF_HOME": "/hf-cache"})
)
hf_cache = modal.Volume.from_name("hf-cache")

# screen -> prompt (text only). Tempo words steer the model; the real tempo is measured afterwards.
PROMPTS = {
    "course": "fast eurobeat, 160 bpm, driving synth bass, bright saw lead, punchy drums, intense, racing energy, instrumental loop",
    "map": "flowing cinematic electronic, 100 bpm, warm arpeggiated synth, soft pulse, wide and curious, exploring a city from above, instrumental loop",
    "editor": "calm ambient electronic, 80 bpm, soft pads, gentle bell notes, focused and spacious, light percussion, instrumental loop",
    "dojo": "quiet reflective piano and soft strings, 70 bpm, warm, slow, thoughtful, no drums, instrumental loop",
    "report": "hopeful uplifting electronic, 110 bpm, bright plucks, gentle beat, a calm sense of finishing a run, instrumental loop",
}
SEEDS = [11, 22, 33, 44]


@app.function(image=image, gpu=["L4", "A10G", "L40S"], timeout=1800, volumes={"/hf-cache": hf_cache}, max_containers=3)
def make(job: dict) -> dict:
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    proc = AutoProcessor.from_pretrained(MODEL)
    m = MusicgenForConditionalGeneration.from_pretrained(MODEL, torch_dtype=torch.float16).to("cuda")
    torch.manual_seed(job["seed"])
    inp = proc(text=[job["prompt"]], return_tensors="pt").to("cuda")
    out = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(SECONDS * m.config.audio_encoder.frame_rate))
    wav = out[0, 0].float().cpu().numpy().astype("float32")
    return {**job, "rate": m.config.audio_encoder.sampling_rate, "wav": wav.tobytes()}


# Round 2 (owner, 2026-10-29: the eurobeat Course loop was too intense): motivational, mid-tempo, warm, no harsh leads.
PROMPTS2 = {
    "course-a": "motivational cinematic pulse, 110 bpm, steady driving warm bass, light percussion, soft strings swelling, rising feel, no lead synth, instrumental loop",
    "course-b": "uplifting underscore, 105 bpm, soft steady kick, warm bassline, gentle plucks, building and hopeful, determined, no harsh synths, instrumental loop",
    "course-c": "training montage, 115 bpm, warm electric bass, light shuffled hi-hats, rising piano chords and strings, confident forward momentum, instrumental loop",
    "course-d": "gentle epic motivational pulse, 100 bpm, low ostinato strings, soft taiko drums, warm, rising, no brass, no synth lead, instrumental loop",
    "course-e": "cinematic electronic, 120 bpm, steady pulsing warm bass, light percussion, airy pads rising, focused and determined, no lead, instrumental loop",
    "course-f": "inspiring acoustic and electronic mix, 110 bpm, muted guitar pulse, warm bass, soft claps, swelling pads, optimistic, instrumental loop",
}
SEEDS2 = [7, 8]


@app.local_entrypoint()
def round2(out: str = "data/eval/cc-132-music/round2"):
    jobs = [{"screen": s, "seed": sd, "prompt": p} for s, p in PROMPTS2.items() for sd in SEEDS2]
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    meta = []
    for r in make.map(jobs):
        (o / f"{r['screen']}_{r['seed']}.f32").write_bytes(r.pop("wav"))
        meta.append(r)
        print("done", r["screen"], r["seed"], flush=True)
    (o / "run.json").write_text(json.dumps({"model": MODEL, "seconds": SECONDS, "jobs": meta}, indent=2) + "\n")


@app.local_entrypoint()
def main(out: str = "data/eval/cc-132-music/outputs"):
    jobs = [{"screen": s, "seed": sd, "prompt": p} for s, p in PROMPTS.items() for sd in SEEDS]
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    meta = []
    for r in make.map(jobs):
        f = o / f"{r['screen']}_{r['seed']}.f32"
        f.write_bytes(r.pop("wav"))
        meta.append(r)
        print("done", f.name, flush=True)
    (o / "run.json").write_text(json.dumps({"model": MODEL, "seconds": SECONDS, "jobs": meta}, indent=2) + "\n")
