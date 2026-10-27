"""Contact sheet for a baked object: the photo with its box, the mask, and the real mesh from the front, the side and the top.

The mesh is drawn by a small painter's-algorithm renderer (flat shading times vertex colour), so the sheet shows the file that ships."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PolyCollection
from PIL import Image

LIGHT = np.array([0.35, 0.8, 0.5]) / np.linalg.norm([0.35, 0.8, 0.5])


def shade_faces(v, f, col_u8):
    """Per-face colour: mean vertex colour times a soft lambert term from a fixed light (in the object's frame)."""
    tri = v[f]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    lam = 0.55 + 0.45 * np.abs(n @ LIGHT)
    base = (np.asarray(col_u8, float)[f].mean(1) / 255) if col_u8 is not None else np.full((len(f), 3), 0.7)
    return np.clip(base * lam[:, None], 0, 1)


def draw_view(ax, v, f, col_u8, axes, depth_axis, flip_depth, title):
    """Orthographic view: `axes` = (horizontal, vertical) coordinate indices; faces further along `depth_axis` are drawn first."""
    p2 = v[:, list(axes)]
    colours = shade_faces(v, f, col_u8)
    depth = v[f][:, :, depth_axis].mean(1) * (-1 if flip_depth else 1)
    order = np.argsort(-depth)  # far first
    ax.add_collection(PolyCollection(p2[f][order], facecolors=colours[order], edgecolors="none", linewidths=0))
    lo, hi = p2.min(0), p2.max(0)
    pad = 0.08 * max(hi - lo)
    ax.set_xlim(lo[0] - pad, hi[0] + pad)
    ax.set_ylim(lo[1] - pad, hi[1] + pad)
    ax.set_aspect("equal")
    ax.set_title(title, fontsize=9)
    ax.tick_params(labelsize=7)
    ax.grid(alpha=0.25)


def sheet(photo_path, box, mask_path, v, f, col_u8, out_path, title=""):
    """photo + box | mask on photo | front (x, y) | side (z, y) | top (x, z); axes are metres."""
    v = np.asarray(v, float)
    f = np.asarray(f, np.int64)
    photo = np.asarray(Image.open(photo_path).convert("RGB"))
    fig, ax = plt.subplots(1, 5, figsize=(21, 4.6), gridspec_kw={"width_ratios": [1.5, 1.5, 1.6, 1.0, 1.6]})
    ax[0].imshow(photo)
    x0, y0, x1, y1 = box
    ax[0].add_patch(plt.Rectangle((x0, y0), x1 - x0, y1 - y0, fill=False, ec="red", lw=2))
    ax[0].set_title("photo and box", fontsize=9)
    ax[0].axis("off")
    ov = photo.astype(float)
    if mask_path:
        m = np.asarray(Image.open(mask_path).convert("L")) > 127
        ov[m] = ov[m] * 0.4 + np.array([40, 220, 90]) * 0.6
    ax[1].imshow(ov.astype(np.uint8))
    ax[1].set_title("mask", fontsize=9)
    ax[1].axis("off")
    e = v.max(0) - v.min(0)
    draw_view(ax[2], v, f, col_u8, (0, 1), 2, False, f"front (x along the course): {e[0]:.2f} m wide, {e[1]:.2f} m high")
    draw_view(ax[3], v, f, col_u8, (2, 1), 0, True, f"side: {e[2]:.2f} m deep")
    draw_view(ax[4], v, f, col_u8, (0, 2), 1, True, "top")
    ax[2].axhline(0, color="#444", lw=1)
    ax[3].axhline(0, color="#444", lw=1)
    fig.suptitle(f"{title}   ({len(f)} faces)", fontsize=11)
    fig.tight_layout()
    fig.savefig(out_path, dpi=75)
    plt.close(fig)
