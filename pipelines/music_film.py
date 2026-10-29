"""CC-209: one longer original track for the film (MusicGen, text prompt only, continued twice from its own last 10 s).

Run: modal run pipelines/music_film.py --out data/eval/cc-spectacle/music
Model: facebook/musicgen-medium (weights CC BY-NC 4.0, code MIT). Cost: one L4-class GPU for a few minutes, about $1 at most (Modal pay-as-you-go).
"""
import json, pathlib
import modal

MODEL = "facebook/musicgen-medium"
PROMPT = "gentle epic motivational pulse, 100 bpm, low ostinato strings, soft taiko drums, warm, steadily building to a lift, no brass, no synth lead, instrumental, no fade"
SEED = 7
app = modal.App("cc209-film-music")
image = (modal.Image.debian_slim(python_version="3.10").pip_install("torch", "transformers>=4.45", "numpy", "scipy", "accelerate").env({"HF_HOME": "/hf-cache"}))
hf_cache = modal.Volume.from_name("hf-cache")


@app.function(image=image, gpu=["L4", "A10G", "L40S"], timeout=1800, volumes={"/hf-cache": hf_cache})
def make() -> dict:
    import numpy as np, torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    proc = AutoProcessor.from_pretrained(MODEL)
    m = MusicgenForConditionalGeneration.from_pretrained(MODEL, torch_dtype=torch.float16).to("cuda")
    sr, fr = m.config.audio_encoder.sampling_rate, m.config.audio_encoder.frame_rate
    torch.manual_seed(SEED)
    inp = proc(text=[PROMPT], return_tensors="pt").to("cuda")
    wav = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(30 * fr))[0, 0].float().cpu().numpy()
    parts = [wav]
    for k in range(2):  # continue from the last 10 s: each round adds 20 new seconds
        tail = parts[-1][-10 * sr:] if k else wav[-10 * sr:]
        inp = proc(text=[PROMPT], audio=tail, sampling_rate=sr, return_tensors="pt").to("cuda")
        inp = {a: (b.to(torch.float16) if b.dtype == torch.float32 else b) for a, b in inp.items()}
        out = m.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=int(30 * fr))[0, 0].float().cpu().numpy()
        parts.append(out)
    # join: keep each earlier part up to its last 10 s, then the continuation (which starts with that same 10 s re-rendered)
    full = np.concatenate([parts[0][:-10 * sr], parts[1][:-10 * sr], parts[2]])
    return {"rate": sr, "wav": full.astype("float32").tobytes(), "seconds": len(full) / sr}


@app.local_entrypoint()
def main(out: str = "data/eval/cc-spectacle/music"):
    r = make.remote()
    o = pathlib.Path(out); o.mkdir(parents=True, exist_ok=True)
    (o / "film-track.f32").write_bytes(r.pop("wav"))
    (o / "film-track.run.json").write_text(json.dumps({"model": MODEL, "prompt": PROMPT, "seed": SEED, "guidance_scale": 3.0, "method": "30 s, then two continuations from the last 10 s", **r}, indent=2) + "\n")
    print("done", r)
