"""Reference numbers for Signal processing: the Python plausibility gate and an independent numpy filter,
run on the same cases as the TypeScript port (src/lab/signal-lab.ts). Writes tests/fixtures/lab-signal-reference.json.

Usage: python3 scripts/lab_signal_reference.py
The noise is the same seeded generator (mulberry32 + Box-Muller) written again here, so both sides draw the same numbers."""
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipelines"))
from ccpipe.clip import Clip  # noqa: E402
from ccpipe import gate  # noqa: E402
from ccpipe.skeleton import PARENTS  # noqa: E402

SEED = 20261031


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        return (x * y) & 0xFFFFFFFF

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


def add_noise(frames, sigma_cm):
    rnd = mulberry32(SEED)
    out = np.array(frames, float)
    for t in range(out.shape[0]):
        for j in range(out.shape[1]):
            for a in range(3):
                u = max(rnd(), 1e-12)
                v = rnd()
                out[t, j, a] += sigma_cm / 100 * math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)
    return out


def kernel(kind, h):
    if h <= 0:
        return np.array([1.0])
    k = np.arange(-h, h + 1)
    if kind == "average":
        w = np.ones(2 * h + 1)
    elif kind == "triangle":
        w = (h + 1 - np.abs(k)).astype(float)
    elif kind == "savgol":  # a real quadratic least-squares fit, evaluated at the middle, instead of the closed form
        A = np.vander(k.astype(float), 3, increasing=True)
        return np.linalg.pinv(A)[0]
    w = w / w.sum()
    return w


def smooth(frames, kind, strength):
    if strength <= 0:
        return frames.copy()
    if kind == "exponential":
        a = 1.0 / (1 + strength)
        y = frames.copy()
        for t in range(1, len(frames)):
            y[t] = y[t - 1] + a * (frames[t] - y[t - 1])
        return y
    k = kernel(kind, strength)
    h = (len(k) - 1) // 2
    pad = np.pad(frames, ((h, h), (0, 0), (0, 0)), mode="edge")
    return sum(k[i] * pad[i:i + len(frames)] for i in range(len(k)))


def fixed_skeleton(w):
    out = w.copy()
    med = {i: np.median(np.linalg.norm(w[:, i] - w[:, p], axis=1)) for i, p in enumerate(PARENTS) if p >= 0}
    for i, p in enumerate(PARENTS):
        if p < 0:
            continue
        d = w[:, i] - w[:, p]
        d = d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)
        out[:, i] = out[:, p] + d * med[i]
    return out


def case(clip, name, kind, strength, noise, fix):
    base = clip.frames
    f = smooth(add_noise(base, noise), kind, strength)
    if fix:
        f = fixed_skeleton(f)
    c = Clip(f, clip.fps, meta=dict(clip.meta))
    r = gate.run_gate(c)
    return {
        "clip": name, "kind": kind, "strength": strength, "noiseCm": noise, "fixBones": fix,
        "pass": r["pass"],
        "values": {k: v["value"] for k, v in {**r["hard"], **r["soft"]}.items()},
        "oks": {k: v["ok"] for k, v in {**r["hard"], **r["soft"]}.items()},
        "sum": round(float(f.sum()), 6),
        "hipsY": [round(float(f[t, 0, 1]), 6) for t in (0, 10, 20, 30)],
    }


def main():
    clips = {n: Clip.load(ROOT / f"public/assets/motion/{n}.json") for n in ("run", "leap", "vault")}
    cases = []
    for n, c in clips.items():
        cases.append(case(c, n, "triangle", 0, 0.0, False))
        for kind in ("average", "triangle", "savgol", "exponential"):
            for s in (2, 5):
                cases.append(case(c, n, kind, s, 1.5, False))
        cases.append(case(c, n, "triangle", 2, 4.0, True))
    cases.append(case(clips["leap"], "leap", "savgol", 8, 1.5, False))
    cases.append(case(clips["leap"], "leap", "exponential", 8, 1.5, False))
    cases.append(case(clips["leap"], "leap", "average", 1, 0.0, False))
    out = {"about": "Python gate and numpy filters on the cases tests/lab-signal.test.ts re-runs in TypeScript. Made by scripts/lab_signal_reference.py.", "seed": SEED, "cases": cases}
    (ROOT / "tests/fixtures/lab-signal-reference.json").write_text(json.dumps(out, indent=2) + "\n")
    print(len(cases), "cases")


main()
