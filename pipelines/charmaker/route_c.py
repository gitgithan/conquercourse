"""Route C, the fallback when the lift fails (CC-108): the Rookie's own body in the picture's colours.
It needs no lift, so it cannot fail the way the lift does, and it moves exactly like the Rookie. It is not a head or hat part (a part needs a mesh to cut it from)."""
from __future__ import annotations
import colorsys, io
import numpy as np
from PIL import Image

from . import rig as rt
from . import objbake_shim as ob
from .contracts import Baked


def dominant_hue(png: bytes, mask_png: bytes | None):
    """(hue 0..1, saturation 0..1) of the most colourful part of the figure, found on a 64 px copy."""
    im = Image.open(io.BytesIO(png)).convert("RGB").resize((64, 64), Image.LANCZOS)
    a = np.asarray(im) / 255.0
    sel = np.ones((64, 64), bool)
    if mask_png:
        sel = np.asarray(Image.open(io.BytesIO(mask_png)).convert("L").resize((64, 64), Image.NEAREST)) > 127
    px = a[sel] if sel.any() else a.reshape(-1, 3)
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px])
    w = hsv[:, 1] * hsv[:, 2]
    if w.sum() < 1e-6:
        return 0.0, 0.0
    ang = hsv[:, 0] * 2 * np.pi
    h = (np.arctan2((w * np.sin(ang)).sum(), (w * np.cos(ang)).sum()) / (2 * np.pi)) % 1.0
    return float(h), float(min(1.0, (w * hsv[:, 1]).sum() / w.sum()))


def rookie_in_your_colours(png: bytes, mask_png: bytes | None, faces: int = 3000, template: rt.Template | None = None) -> Baked:
    t = template or rt.Template()
    prim = t.j["meshes"][0]["primitives"][0]
    f = rt.acc(t.j, t.bin, prim["indices"]).reshape(-1, 3).astype(np.int64)
    uv = rt.acc(t.j, t.bin, prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
    bv = t.j["bufferViews"][t.j["images"][0]["bufferView"]]
    tex = np.asarray(Image.open(io.BytesIO(t.bin[bv["byteOffset"]: bv["byteOffset"] + bv["byteLength"]])).convert("RGB"))
    th, tw = tex.shape[:2]
    px = np.clip((uv[:, 0] * tw).astype(int), 0, tw - 1), np.clip((uv[:, 1] * th).astype(int), 0, th - 1)
    rgb = tex[px[1], px[0]] / 255.0
    hue, sat = dominant_hue(png, mask_png)
    hsv = np.array([colorsys.rgb_to_hsv(*c) for c in rgb])
    colourful = hsv[:, 1] > 0.3
    dom = np.median(hsv[colourful, 0]) if colourful.any() else 0.0
    hsv[colourful, 0] = (hsv[colourful, 0] - dom + hue) % 1.0
    hsv[colourful, 1] = np.clip(hsv[colourful, 1] * (0.7 + 0.6 * sat), 0, 1)
    new = np.array([colorsys.hsv_to_rgb(*c) for c in hsv])
    v, ff = ob.decimate(t.v, f, faces)
    v, ff, uv2 = ob.unwrap(v, ff)
    # colour the new mesh from the old vertices (nearest ones), through the same texture baker the lift uses
    tex2 = ob.bake_texture(v, ff, uv2, t.v, new, None, size=512, k=4)
    return Baked(v=v, f=ff, uv=uv2, tex=tex2, info={"route": "C", "hue": round(hue, 3), "sat": round(sat, 3)})
