"""Pictures for the README: a GIF per move (masked frame beside a side-view skeleton with the obstacle) and the obstacle overlay."""
import numpy as np
from PIL import Image, ImageDraw

from .skeleton import IDX, PARENTS

PANEL = 400


def _view(frames, prim_h, contacts):
    """Side-view window (z across, y up) that holds the whole move; metres to pixels."""
    z = frames[:, :, 2]
    y = frames[:, :, 1]
    z0, z1 = float(z.min()) - 0.4, float(z.max()) + 0.4
    top = max(float(y.max()), prim_h or 0.0) + 0.3
    scale = min(PANEL / max(z1 - z0, 1.0), PANEL / top)
    return z0, scale


def side_frame(frames, i, t, prim, contacts, verdict, fps):
    img = Image.new("RGB", (PANEL, PANEL), (24, 28, 36))
    d = ImageDraw.Draw(img)
    prim_h = None if not prim else prim["sizes"].get("height", prim["sizes"].get("anchorHeight"))
    z0, s = _view(frames, prim_h, contacts)
    px = lambda z, y: ((z - z0) * s + 10, PANEL - 20 - y * s)
    d.line([px(z0 - 1, 0), px(z0 + PANEL / s + 1, 0)], fill=(90, 100, 110), width=2)
    obs = [c for c in contacts if c["kind"] == "obstacle"]
    if prim and prim_h and obs:
        zf = min(c["point"][2] for c in obs) - 0.1
        thick = prim["sizes"].get("thickness", prim["sizes"].get("run", 0.4))
        thick = min(float(thick), 1.5)
        d.rectangle([px(zf - thick, prim_h), px(zf, 0)], outline=(240, 170, 60), width=2)
        d.text((px(zf - thick, prim_h)[0], px(zf - thick, prim_h)[1] - 12), f"{prim['type']} {prim_h:.1f} m", fill=(240, 170, 60))
    f = frames[i]
    for j, p in enumerate(PARENTS):
        if p >= 0:
            d.line([px(f[p, 2], f[p, 1]), px(f[j, 2], f[j, 1])], fill=(120, 200, 255), width=3)
    for c in contacts:
        if c["frames"][0] <= i <= c["frames"][1]:
            x, y = px(c["point"][2], c["point"][1])
            d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 90, 90) if c["kind"] == "obstacle" else (120, 255, 140), width=3)
    d.text((8, 6), f"t={t:.2f}s   gate: {verdict}", fill=(255, 255, 255))
    return img


def move_gif(frames, times, contacts, prim, verdict, masked_paths, kp2d, out_path, max_frames=40):
    """masked_paths[i] / kp2d[i]: the face-masked, people-blurred frame and the 2D keypoints (or None) for motion frame i."""
    n = len(frames)
    idx = np.unique(np.linspace(0, n - 1, min(n, max_frames)).astype(int))
    fps = (n - 1) / (times[-1] - times[0])
    out = []
    for i in idx:
        side = side_frame(frames, i, times[i] - times[0], prim, contacts, verdict, fps)
        left = Image.new("RGB", (PANEL, PANEL), (0, 0, 0))
        if masked_paths and masked_paths[i]:
            im = Image.open(masked_paths[i]).convert("RGB")
            sc = PANEL / max(im.size)
            small = im.resize((int(im.width * sc), int(im.height * sc)))
            if kp2d and kp2d[i] is not None:
                d = ImageDraw.Draw(small)
                for x, y in np.array(kp2d[i])[:, :2]:
                    d.ellipse([x * sc - 2, y * sc - 2, x * sc + 2, y * sc + 2], fill=(255, 230, 0))
            left.paste(small, ((PANEL - small.width) // 2, (PANEL - small.height) // 2))
        both = Image.new("RGB", (2 * PANEL, PANEL))
        both.paste(left, (0, 0))
        both.paste(side, (PANEL, 0))
        out.append(both.resize((PANEL * 5 // 4, PANEL * 5 // 8)).quantize(colors=64))
    dur = int(1000 * (times[-1] - times[0]) / len(out))
    out[0].save(out_path, save_all=True, append_images=out[1:], duration=max(dur, 40), loop=0, optimize=True)
    return len(out)


COLORS = [(230, 60, 60), (60, 120, 230), (250, 200, 30), (60, 200, 90), (190, 80, 220), (0, 200, 200), (255, 140, 0), (150, 110, 60), (240, 140, 200), (120, 200, 255)]


def obstacle_overlay(img_path, objs, out_path):
    """objs: [{phrase, mask: (arr, ox, oy) or None, box, score}] painted on the (people-blurred) frame, legend top left."""
    img = Image.open(img_path).convert("RGB")
    canvas = np.array(img, np.float32)
    phrases = sorted({o["phrase"] for o in objs})
    for o in objs:
        if o.get("mask") is None:
            continue
        arr, ox, oy = o["mask"]
        reg = canvas[oy:oy + arr.shape[0], ox:ox + arr.shape[1]]
        a = arr[:reg.shape[0], :reg.shape[1]].astype(bool)
        reg[a] = reg[a] * 0.45 + np.array(COLORS[phrases.index(o["phrase"]) % len(COLORS)], np.float32) * 0.55
    out = Image.fromarray(canvas.astype(np.uint8))
    d = ImageDraw.Draw(out)
    for k, ph in enumerate(phrases):
        d.rectangle([6, 6 + 18 * k, 20, 20 + 18 * k], fill=COLORS[k % len(COLORS)])
        d.text((26, 7 + 18 * k), f"{ph}: {sum(1 for o in objs if o['phrase'] == ph)}", fill=(255, 255, 255))
    out.save(out_path, quality=85)
