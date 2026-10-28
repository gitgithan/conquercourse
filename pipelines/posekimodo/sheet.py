"""CC-54: side-view stick figures of the keyed Kimodo result (black) against its key pose (red), and the text-only baseline (grey).
Run: python3 sheet.py <outputs dir> <out.png> <move> <round> <seed> <frame>   (needs numpy and matplotlib)"""
import json
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
from ccpipe.skeleton import BONES  # noqa: E402
from spec import moves  # noqa: E402


def stick(ax, f, col, lw):
    for a, b in BONES:
        ax.plot([f[a, 2], f[b, 2]], [f[a, 1], f[b, 1]], color=col, lw=lw)


def main(d, out, move, rnd, seed, frame):
    data = json.load(open(os.path.join(d, "kimodo_samples.json")))
    s = next(x for x in data["moves"][move]["samples"] if x["seed"] == seed)
    keys = dict(moves(rnd)[move]["keys"])
    fig, axs = plt.subplots(1, 2, figsize=(9, 4.5), sharey=True)
    for ax, kind, title in ((axs[0], "baseline", "text only"), (axs[1], "keyed", "held to key poses")):
        f = np.asarray(s[kind][frame])
        stick(ax, f, "k", 2)
        if frame in keys:
            stick(ax, np.asarray(keys[frame]), "r", 1)
        ax.axhline(0, color="g", lw=1)
        ax.set_aspect("equal")
        ax.set_title(f"{move} frame {frame}: {title}")
        ax.set_xlabel("forward (m)")
    axs[0].set_ylabel("height (m)")
    fig.suptitle("black: Kimodo result; red: the key pose it was asked for", fontsize=9)
    fig.savefig(out, dpi=110, bbox_inches="tight")


if __name__ == "__main__":
    a = sys.argv
    main(a[1], a[2], a[3], int(a[4]), int(a[5]), int(a[6]))
