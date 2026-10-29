#!/usr/bin/env python3
"""Measure the tempo and the first beat of a music file (no hand-typed numbers).

Usage: python3 scripts/measure-bpm.py <audio file> [--seconds 60]
Prints one JSON object: bpm, firstBeat (seconds), confidence, and the beat times.
"""
import json, subprocess, sys
import numpy as np

SR, HOP, WIN = 22050, 256, 1024

def load(path, seconds):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-t", str(seconds), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onset_envelope(x):
    n = 1 + (len(x) - WIN) // HOP
    win = np.hanning(WIN)
    frames = np.stack([x[i * HOP:i * HOP + WIN] * win for i in range(n)])
    mag = np.log1p(30 * np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(43) / 43, mode="same")
    return np.maximum(flux, 0)

def measure(path, seconds=60):
    env = onset_envelope(load(path, seconds))
    fps = SR / HOP
    best = (0.0, 0.0)
    for bpm in np.arange(70.0, 180.0, 0.1):
        step = fps * 60 / bpm
        # comb score: mean envelope on a grid of beats, best over the phase
        for ph in np.arange(0, step, 1.0):
            idx = np.round(np.arange(ph, len(env) - 1, step)).astype(int)
            s = env[idx].mean()
            if s > best[0]:
                best = (s, bpm, ph)
    score, bpm, ph = best
    step = 60 / bpm
    first = ph / fps
    total = len(env) / fps
    beats = [round(first + k * step, 3) for k in range(int((total - first) / step) + 1)]
    return {"file": path.split("/")[-1], "bpm": round(float(bpm), 1), "firstBeat": round(first, 3),
            "confidence": round(float(score / (env.mean() + 1e-9)), 2), "beats": beats[:16]}

if __name__ == "__main__":
    p = sys.argv[1]
    sec = float(sys.argv[sys.argv.index("--seconds") + 1]) if "--seconds" in sys.argv else 60
    print(json.dumps(measure(p, sec), indent=2))
