"""CC-132: cut each generated 30 s clip into a loop of whole bars and measure it (numbers only, no listening).

Run: python3 pipelines/cut_loops.py RUN_JSON RAW_DIR OUT_DIR [only] [ffmpeg-filter] [suffix]
Steps per clip:
- estimate the tempo from the onset envelope;
- take a whole number of 4-beat bars near 15 s;
- pick the start whose pre-roll best matches the pre-roll of the end;
- fade the tail into that pre-roll, so the wrap continues the audio instead of jumping.
"""
import json
import pathlib
import subprocess
import sys
import wave

import numpy as np

HOP = 256
FADE = 0.06  # seconds of tail crossfade


def onset_env(x, rate):
    n = 1024
    win = np.hanning(n)
    frames = [np.abs(np.fft.rfft(x[i:i + n] * win)) for i in range(0, len(x) - n, HOP)]
    S = np.log1p(np.array(frames) * 10)
    flux = np.maximum(0, np.diff(S, axis=0)).sum(1)
    return flux - flux.mean(), rate / HOP


def tempo(x, rate, lo=60, hi=180):
    env, fr = onset_env(x, rate)
    ac = np.correlate(env, env, "full")[len(env) - 1:]
    idx = np.arange(len(ac))
    best, bs = 0.0, -1.0
    for bpm in np.arange(lo, hi, 0.25):
        lag = fr * 60 / bpm
        s = sum(np.interp(lag * k, idx, ac) for k in (1, 2, 4))
        if s > bs:
            bs, best = s, bpm
    return float(best)


def cut(x, rate):
    bpm = tempo(x, rate)
    bar = 4 * 60 / bpm
    bars = max(2, round(15 / bar))
    L = int(round(bars * bar * rate))
    pre = int(FADE * rate)
    cands = []
    for s in range(pre, min(int(4 * rate), len(x) - L - 1), int(0.002 * rate)):
        e = s + L
        a, b = x[s - pre:s], x[e - pre:e]
        err = float(np.mean((a - b) ** 2) / (np.mean(a ** 2) + 1e-9))
        cands.append((err, s))
    cands.sort()
    # among starts that match nearly as well as the best, take the one where the wave steps least between sample s-1 and s (that step is the wrap)
    good = [c for c in cands if c[0] <= cands[0][0] * 1.5 + 0.02]
    best = min(good, key=lambda c: abs(float(x[c[1]] - x[c[1] - 1])))
    s = best[1]
    e = s + L
    loop = x[s:e].copy()
    w = np.sin(np.linspace(0, np.pi / 2, pre)) ** 2
    loop[-pre:] = x[e - pre:e] * (1 - w) + x[s - pre:s] * w
    return loop, bpm, bars, best[0]


def stats(loop, rate):
    step = np.abs(np.diff(loop))
    seam = abs(float(loop[0] - loop[-1]))
    rms = float(np.sqrt(np.mean(loop ** 2)))
    spec = np.abs(np.fft.rfft(loop * np.hanning(len(loop))))
    freqs = np.fft.rfftfreq(len(loop), 1 / rate)
    env, _ = onset_env(loop, rate)
    hf = float((spec[freqs >= 5000] ** 2).sum() / (spec ** 2).sum())
    return {"hf_share_5k": hf, "seam_jump": seam, "median_step": float(np.median(step)), "seam_ratio": seam / (float(np.median(step)) + 1e-9),
            "rms": rms, "peak": float(np.abs(loop).max()), "centroid_hz": float((spec * freqs).sum() / spec.sum()),
            "onsets_per_s": float((env > env.std() * 1.5).sum() / (len(loop) / rate))}


def soften(x, rate, af):
    """Run the raw clip through an ffmpeg audio filter (before cutting, so the loop seam is made from the filtered wave)."""
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "-", "-af", af, "-f", "f32le", "-"],
                       input=x.tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="float32").copy()


def main(run_json, raw, dst, only="", af="", suffix=""):
    """only: comma list of names (screen_seed) to cut; af: optional ffmpeg filter; suffix: appended to the output name."""
    run_json, raw, dst = pathlib.Path(run_json), pathlib.Path(raw), pathlib.Path(dst)
    dst.mkdir(parents=True, exist_ok=True)
    run = json.load(open(run_json))
    rows = []
    for j in run["jobs"]:
        if only and f"{j['screen']}_{j['seed']}" not in only.split(","):
            continue
        x = np.fromfile(raw / f"{j['screen']}_{j['seed']}.f32", dtype="float32")
        rate = j["rate"]
        before = stats(x, rate)["hf_share_5k"] if af else None
        if af:
            x = soften(x, rate, af)
        loop, bpm, bars, err = cut(x, rate)
        loop = loop * (0.1 / (np.sqrt(np.mean(loop ** 2)) + 1e-9))  # the same loudness for every loop (rms 0.1)
        loop = np.clip(loop, -0.98, 0.98)
        st = stats(loop, rate)
        name = f"{j['screen']}_{j['seed']}{suffix}"
        raw_wav = dst / f"{name}.wav"
        with wave.open(str(raw_wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes((loop * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw_wav), "-c:a", "libvorbis", "-q:a", "3", str(dst / f"{name}.ogg")], check=True)
        rows.append({"name": name, "screen": j["screen"], "seed": j["seed"], "bpm": round(bpm, 2), "bars": bars, "seconds": round(len(loop) / rate, 3),
                     "match_err": round(err, 4), **{k: round(v, 5) for k, v in st.items()}, **({"hf_share_5k_before": round(before, 5), "filter": af} if af else {})})
        print(rows[-1], flush=True)
    (run_json.parent / f"loops{suffix or ''}.json").write_text(json.dumps(rows, indent=2) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
