"""Stick-figure film and contact sheet of a monkey-bars clip, side and front view, on the stepped clock (CC-133).

    uv run --no-project --with numpy --with matplotlib python -I pipelines/bars_render.py <clip.json> <out prefix> [--rungs 0.4 --rung-y 2.2] [--mp4]

Every frame is drawn at its own clip time (frame i is at i / fps), so the film does not depend on how fast the machine draws.
The contact sheet shows 8 frames side by side; the film is `<prefix>.mp4` with ffmpeg (one frame per clip frame at the clip's fps).
Hands are red (left) and blue (right); rungs are drawn as short bars at the rung height every `--rungs` metres."""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from ccpipe.skeleton import BONES, IDX  # noqa: E402

RED = {IDX["LeftHand"], IDX["LeftForeArm"], IDX["LeftArm"], IDX["LeftShoulder"]}
BLUE = {IDX["RightHand"], IDX["RightForeArm"], IDX["RightArm"], IDX["RightShoulder"]}


def draw(ax, f, view, z0, span, rung_gap, rung_y):
    h = 2 if view == "side" else 0
    for p, c in BONES:
        col = "tab:red" if c in RED else "tab:blue" if c in BLUE else "k"
        ax.plot([f[p, h], f[c, h]], [f[p, 1], f[c, 1]], col, lw=2)
    if view == "side":
        for r in np.arange(np.floor((z0 - span) / rung_gap) * rung_gap, z0 + span, rung_gap):
            ax.plot([r, r], [rung_y - 0.04, rung_y + 0.04], color="0.55", lw=3)
        ax.axhline(rung_y, color="0.8", lw=0.8)
    ax.axhline(0, color="0.5", lw=1)
    ax.set_xlim(z0 - span, z0 + span) if view == "side" else ax.set_xlim(-span, span)
    ax.set_ylim(-0.1, 2.6)
    ax.set_aspect("equal")
    ax.axis("off")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("out")
    ap.add_argument("--rungs", type=float, default=0.4)
    ap.add_argument("--rung-y", type=float, default=2.2)
    ap.add_argument("--mp4", action="store_true")
    a = ap.parse_args()
    d = json.load(open(a.clip))
    F, fps = np.array(d["frames"]), d["fps"]
    z0s = F[:, 0, 2]
    span = 1.2
    fig, axs = plt.subplots(2, 8, figsize=(20, 7))
    for k, i in enumerate(np.linspace(0, len(F) - 1, 8).astype(int)):
        draw(axs[0, k], F[i], "side", z0s[i], span, a.rungs, a.rung_y)
        draw(axs[1, k], F[i], "front", z0s[i], 0.8, a.rungs, a.rung_y)
        axs[0, k].set_title(f"t={i / fps:.2f}s", fontsize=9)
    plt.tight_layout()
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    plt.savefig(a.out + "_sheet.png", dpi=55)
    plt.close()
    if a.mp4:
        tmp = tempfile.mkdtemp()
        for i in range(len(F)):
            fig, axs = plt.subplots(1, 2, figsize=(9, 5), gridspec_kw={"width_ratios": [2.2, 1]})
            draw(axs[0], F[i], "side", z0s[i], span, a.rungs, a.rung_y)
            draw(axs[1], F[i], "front", z0s[i], 0.8, a.rungs, a.rung_y)
            fig.suptitle(f"{os.path.basename(a.clip)}   t = {i / fps:.2f} s (frame {i})", fontsize=10)
            plt.savefig(os.path.join(tmp, f"f{i:04d}.png"), dpi=60)
            plt.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(tmp, "f%04d.png"),
                        "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", a.out + ".mp4"], check=True)


if __name__ == "__main__":
    main()
