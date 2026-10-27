"""A side-view GIF of a wall clip: the curve, the deck, the targets and the skeleton (CC-17). Candidates, passing and failing alike."""
import numpy as np
from PIL import Image, ImageDraw

from .skeleton import PARENTS

W, H = 300, 360


def _frame(f, i, wall, targets, label, view):
    z0, z1, y0, y1 = view
    s = min((W - 12) / (z1 - z0), (H - 30) / (y1 - y0))
    px = lambda z, y: (6 + (z - z0) * s, H - 8 - (y - y0) * s)
    img = Image.new("RGB", (W, H), (24, 28, 36))
    d = ImageDraw.Draw(img)
    zs = np.linspace(0, wall.r, 60)
    curve = [px(z, float(wall.surface_y(z))) for z in zs]
    d.polygon(curve + [px(wall.r + 1.5, wall.h), px(wall.r + 1.5, y0), px(z0, y0), px(z0, 0), px(0, 0)], fill=(60, 52, 44))
    d.line(curve + [px(wall.r + 1.5, wall.h)], fill=(240, 170, 60), width=2)
    d.line([px(z0, 0), px(0, 0)], fill=(240, 170, 60), width=2)
    for pin in list(targets["plants"]) + list(targets["grips"]) + list(targets["deck"]):
        a, b = pin["frames"]
        x, y = px(pin["point"][2], pin["point"][1])
        on = a <= i <= b
        d.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(255, 90, 90) if on else (110, 60, 60), width=2)
    sim = targets["sim_hips"][i]
    x, y = px(sim[2], sim[1])
    d.rectangle([x - 3, y - 3, x + 3, y + 3], outline=(120, 255, 140))
    for j, p in enumerate(PARENTS):
        if p >= 0:
            d.line([px(f[i, p, 2], f[i, p, 1]), px(f[i, j, 2], f[i, j, 1])], fill=(120, 200, 255) if j % 2 == 0 else (255, 150, 150), width=3)
    d.text((6, 4), f"{label}  t={i / 30:.2f}s", fill=(255, 255, 255))
    return img


def candidate_gif(path, sample, baseline, targets, wall, label, max_frames=45):
    """Left: the text-only baseline of the same seed; right: the sample (green square = the simulator's hips).
    The camera follows the sample's hips so the body is large enough to judge."""
    idx = np.unique(np.linspace(0, len(sample) - 1, min(len(sample), max_frames)).astype(int))
    frames = []
    for i in idx:
        zc, yc = float(targets["sim_hips"][i][2]), float(targets["sim_hips"][i][1])
        view = (zc - 2.6, zc + 2.6, min(yc - 2.4, 0.0) if yc < 2.4 else yc - 2.4, (min(yc - 2.4, 0.0) if yc < 2.4 else yc - 2.4) + 7.0)
        both = Image.new("RGB", (2 * W, H))
        both.paste(_frame(baseline, i, wall, targets, "text only (unmoved)", view), (0, 0))
        both.paste(_frame(sample, i, wall, targets, label, view), (W, 0))
        frames.append(both.resize((W * 3 // 2, H * 3 // 4)).quantize(colors=32))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=int(1000 * 2 / 30), loop=0, optimize=True)
    return len(frames)
