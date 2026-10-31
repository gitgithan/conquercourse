"""Rig and package (CC-108): a Baked mesh from any provider becomes one 34-bone character glb inside the size caps, a thumbnail and a small json."""
from __future__ import annotations
import hashlib, io, time
import numpy as np
from PIL import Image

from . import rig as rt
from . import limits
from .contracts import Baked, Package, Refused, Rigged

QUALITY_LADDER = [80, 62, 45]  # jpeg quality for the 256 px texture; the file is mostly vertex data, so this rarely matters


def rig_baked(baked: Baked, template: rt.Template | None = None, tex_px: int = limits.MAX_TEXTURE_PX, quality: int = 80) -> tuple[Rigged, tuple]:
    t0 = time.time()
    t = template or rt.Template()
    V, scale = rt.fit_to_template(t, baked.v)
    joints, weights = rt.nearest_bone_weights(t, V)
    problems = rt.weight_problems(joints, weights)
    if problems:
        raise Refused("; ".join(problems))
    glb, _ = rt.write_skinned_glb(None, t, V, baked.f, baked.uv, baked.tex, joints, weights, jpeg_quality=quality, tex_size=tex_px)
    stretch = rt.edge_stretch(t, V.astype(float), np.asarray(baked.f), joints, weights)
    return Rigged(glb=glb, faces=int(len(baked.f)), verts=int(len(V)), stretch=stretch, seconds=round(time.time() - t0, 2)), (t, scale)


def thumb_from(png: bytes, mask_png: bytes | None, size: int = 96) -> bytes:
    """A 96 px WebP of the figure on a plain square, at most 8 KB."""
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if mask_png:
        m = np.asarray(Image.open(io.BytesIO(mask_png)).convert("L").resize(im.size)) > 127
        if m.any():
            ys, xs = np.where(m)
            pad = int(0.05 * max(im.size))
            box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad))
            im = im.crop(box)
    s = max(im.size)
    sq = Image.new("RGB", (s, s), tuple(int(c) for c in np.asarray(im)[:3, :3].reshape(-1, 3).mean(0)))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    sq = sq.resize((size, size), Image.LANCZOS)
    for q in (70, 55, 40, 28):
        b = io.BytesIO(); sq.save(b, "WEBP", quality=q, method=6)
        if len(b.getvalue()) <= limits.MAX_THUMB_BYTES:
            return b.getvalue()
    raise Refused("the thumbnail is over 8 KB")


def package(baked: Baked, png: bytes, mask_png: bytes | None, meta: dict, template: rt.Template | None = None) -> tuple[Package, Rigged]:
    """Rig, then walk the quality ladder until the file fits the caps; a file that never fits is refused."""
    t = template or rt.Template()
    names = t.names
    last: list[str] = []
    for q in QUALITY_LADDER:
        rigged, _ = rig_baked(baked, t, quality=q)
        last = limits.glb_problems(rigged.glb, names)
        if not last:
            gid = hashlib.sha256(rigged.glb).hexdigest()[:16]
            return Package(id=gid, glb=rigged.glb, thumb_webp=thumb_from(png, mask_png), meta={**meta, "id": gid, "bytes": len(rigged.glb), "faces": rigged.faces, "verts": rigged.verts, "texture_px": limits.MAX_TEXTURE_PX, "jpeg_quality": q}), rigged
    raise Refused("too big for the caps: " + "; ".join(last))
