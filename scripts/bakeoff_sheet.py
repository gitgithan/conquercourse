"""CC-55: side-by-side sheet of the cut-out, SAM 3D, TRELLIS.2 and Pixal3D shapes (shape first: grey shading, no texture).
usage: python scripts/bakeoff_sheet.py   (needs trimesh, matplotlib, numpy, pillow; writes data/eval/object-bakeoff/sheet-*.png)
Every mesh is scaled so its height (y) is the object's typical height, the rule the shipped objects use."""
import json
import os

import matplotlib
import numpy as np
import trimesh
from PIL import Image

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

D = "data/eval/object-bakeoff"
objects = json.load(open("public/assets/objects/index.json"))["objects"]
SOURCES = [("SAM 3D Objects", lambda n: f"public/assets/objects/{n}.glb"), ("TRELLIS.2", lambda n: f"{D}/outputs/trellis2-{n}.glb"),
           ("Pixal3D", lambda n: f"{D}/outputs/pixal3d-{n}.glb")]


def load(path, height):
    m = trimesh.load(path, force="mesh")
    pts, fi = trimesh.sample.sample_surface(m, 30000, seed=1)
    nrm = m.face_normals[fi]
    ext = pts.max(0) - pts.min(0)
    pts = (pts - (pts.max(0) + pts.min(0)) / 2) * (height / max(ext[1], 1e-9))
    return pts, nrm


def draw(ax, pts, nrm, elev, azim, lim):
    light = np.array([0.4, 0.8, 0.45]); light /= np.linalg.norm(light)
    shade = 0.25 + 0.75 * np.clip(nrm @ light, 0, 1)
    ax.scatter(pts[:, 0], pts[:, 2], pts[:, 1], s=0.6, c=shade, cmap="gray", vmin=0, vmax=1, linewidths=0)
    ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.set_zlim(-lim, lim)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev=elev, azim=azim); ax.set_axis_off()


for tag, elev, azim in [("3q", 22, -52), ("side", 0, -90)]:
    fig = plt.figure(figsize=(14, 3.1 * len(objects)))
    for r, o in enumerate(objects):
        h = o["height_m"]
        ax = fig.add_subplot(len(objects), 4, r * 4 + 1)
        im = Image.open(f"{D}/inputs/{o['name']}.png").convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im)
        ax.imshow(bg.convert("RGB")); ax.set_axis_off()
        ax.set_title(f"{o['name']}: cut-out" + ("  (plain crop)" if o["name"] == "railing-iron" else ""), fontsize=9)
        meshes = [(n, load(f(o["name"]), h)) for n, f in SOURCES]
        lim = max(np.abs(p).max() for _, (p, _) in meshes) * 1.02
        for c, (n, (pts, nrm)) in enumerate(meshes):
            ax = fig.add_subplot(len(objects), 4, r * 4 + 2 + c, projection="3d")
            draw(ax, pts, nrm, elev, azim, lim)
            ext = pts.max(0) - pts.min(0)
            ax.set_title(f"{n}: {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.1f} m", fontsize=9)
    fig.tight_layout()
    fig.savefig(f"{D}/sheet-{tag}.png", dpi=70)
    plt.close(fig)
print("ok")
