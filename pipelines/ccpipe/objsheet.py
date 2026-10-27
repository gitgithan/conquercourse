"""Contact sheet for a baked object: the photo with its box, the mask, and the real mesh from the front, the side and the top.

The mesh is drawn by a small z-buffer renderer (smooth vertex colours times a soft light), so the sheet shows the file that ships."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

LIGHT = np.array([0.35, 0.8, 0.5]) / np.linalg.norm([0.35, 0.8, 0.5])


def vertex_shading(v, f):
    """Smooth vertex normals (area-weighted) and a soft two-sided lambert term from a fixed light."""
    tri = v[f]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n = np.zeros_like(v)
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    return 0.55 + 0.45 * np.abs(n @ LIGHT)


def render_view(v, f, col_u8, axes, depth_axis, flip_depth, px=420, bg=255, uv=None, tex=None):
    """Orthographic z-buffer render with smooth per-vertex colours (as a game viewer shows the GLB).

    With `uv` (n, 2, glTF convention) and `tex` (h, w, 3 uint8) the colour is sampled from the texture instead of the vertex colours.
    Returns (image uint8, (x0, x1, y0, y1) in metres) with the vertical axis pointing up."""
    p2 = v[:, list(axes)]
    lo, hi = p2.min(0), p2.max(0)
    span = max(hi - lo)
    pad = 0.08 * span
    scale = (px - 1) / (span + 2 * pad)
    w, h = int((hi[0] - lo[0] + 2 * pad) * scale) + 1, int((hi[1] - lo[1] + 2 * pad) * scale) + 1
    sx = (p2[:, 0] - lo[0] + pad) * scale
    sy = (hi[1] + pad - p2[:, 1]) * scale  # image y runs down
    depth = v[:, depth_axis] * (1 if flip_depth else -1)  # larger = nearer the viewer
    base = np.asarray(col_u8, float) / 255 if col_u8 is not None else np.full((len(v), 3), 0.7)
    shade = vertex_shading(v, f)
    rgb = np.clip(base * shade[:, None], 0, 1)
    if tex is not None:
        th, tw = tex.shape[:2]
    img = np.full((h, w, 3), bg / 255)
    zbuf = np.full((h, w), -np.inf)
    for tri in f:
        xs, ys = sx[tri], sy[tri]
        x0, x1 = max(0, int(np.floor(xs.min()))), min(w - 1, int(np.ceil(xs.max())))
        y0, y1 = max(0, int(np.floor(ys.min()))), min(h - 1, int(np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-12:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
        l2 = 1 - l0 - l1
        inside = (l0 >= -1e-9) & (l1 >= -1e-9) & (l2 >= -1e-9)
        if not inside.any():
            continue
        z = l0 * depth[tri[0]] + l1 * depth[tri[1]] + l2 * depth[tri[2]]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        win = inside & (z > sub)
        sub[win] = z[win]
        if tex is not None:
            u = l0 * uv[tri[0], 0] + l1 * uv[tri[1], 0] + l2 * uv[tri[2], 0]
            w_ = l0 * uv[tri[0], 1] + l1 * uv[tri[1], 1] + l2 * uv[tri[2], 1]
            lam = l0 * shade[tri[0]] + l1 * shade[tri[1]] + l2 * shade[tri[2]]
            col = tex[np.clip((w_ * th).astype(int), 0, th - 1), np.clip((u * tw).astype(int), 0, tw - 1)] / 255 * lam[..., None]
        else:
            col = l0[..., None] * rgb[tri[0]] + l1[..., None] * rgb[tri[1]] + l2[..., None] * rgb[tri[2]]
        img[y0:y1 + 1, x0:x1 + 1][win] = col[win]
    ext = (lo[0] - pad, hi[0] + pad, lo[1] - pad, hi[1] + pad)
    return (img * 255).astype(np.uint8), ext


def draw_view(ax, v, f, col_u8, axes, depth_axis, flip_depth, title, uv=None, tex=None):
    img, (x0, x1, y0, y1) = render_view(v, f, col_u8, axes, depth_axis, flip_depth, uv=uv, tex=tex)
    ax.imshow(img, extent=(x0, x1, y0, y1), interpolation="nearest")
    ax.set_title(title, fontsize=9)
    ax.tick_params(labelsize=7)
    ax.grid(alpha=0.25)


def sheet(photo_path, box, mask_path, v, f, col_u8, out_path, title="", uv=None, tex=None):
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
    draw_view(ax[2], v, f, col_u8, (0, 1), 2, False, f"front (x along the course): {e[0]:.2f} m wide, {e[1]:.2f} m high", uv, tex)
    draw_view(ax[3], v, f, col_u8, (2, 1), 0, True, f"side: {e[2]:.2f} m deep", uv, tex)
    draw_view(ax[4], v, f, col_u8, (0, 2), 1, True, "top", uv, tex)
    ax[2].axhline(0, color="#444", lw=1)
    ax[3].axhline(0, color="#444", lw=1)
    fig.suptitle(f"{title}   ({len(f)} faces)", fontsize=11)
    fig.tight_layout()
    fig.savefig(out_path, dpi=75)
    plt.close(fig)
