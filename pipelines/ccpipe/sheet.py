"""Contact sheet: side-on stick figures of a clip (z across, y up), supported frames marked."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from . import motion
from .skeleton import BONES, IDX


def contact_sheet(clip, path, n=12, title="", cols=6):
    sup = motion.supported(clip.frames, clip.fps)
    picks = np.linspace(0, clip.n - 1, n).round().astype(int)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(2.4 * cols, 2.6 * rows), squeeze=False)
    ymax = max(2.2, clip.frames[:, :, 1].max() + 0.1)
    for ax, t in zip(axes.flat, picks):
        f = clip.frames[t]
        cx = f[IDX["Hips"], 2]
        for p, i in BONES:
            left = clip.names[i].startswith("Left")
            ax.plot([f[p, 2], f[i, 2]], [f[p, 1], f[i, 1]], color="#d1495b" if left else "#2e86ab", lw=1.6)
        ax.axhline(0, color="#555", lw=0.8)
        ax.set_xlim(cx - 1.4, cx + 1.4)
        ax.set_ylim(-0.1, ymax)
        ax.set_aspect("equal")
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_title(f"{t / clip.fps:.2f}s {'held' if sup[t] else 'free'}", fontsize=8)
    for ax in list(axes.flat)[n:]:
        ax.axis("off")
    fig.suptitle(title, fontsize=10)
    fig.tight_layout()
    fig.savefig(path, dpi=80)
    plt.close(fig)
