"""Route A (CC-108): Muse Image draws, SAM 3.1 cuts out, SAM 3D Objects (the Modal app cc-photo-to-object, class Lift) lifts, our bake builds the mesh.
Keys come from the environment (META_API_KEY, META_BASE_URL) or the owner's env file; they are never printed or stored.
Every network call is injectable (`http`, `lift`), so the unit tests run the steps with no network."""
from __future__ import annotations
import base64, io, json, os, re, time, urllib.request
from typing import Callable, Optional

import numpy as np
from PIL import Image

from ..contracts import Baked, CharacterMaker, Cutout, NotConfigured, Picture, Refused, StepFailed
from .. import objbake_shim as ob
from .. import route_c

STYLE = ("Cartoon sports-game art style, soft lighting, plain light-blue background, full body, front view, symmetrical T-pose with arms straight out at shoulder level "
         "and legs shoulder-width apart, clear gaps under the arms and between the legs, one character only, nothing else in the image, no text, no logos.")
MUSE_USD, SAM_USD, L40S_PER_S = 0.01, 0.0025, 1.95 / 3600
FACES, BAKE_TEX = 3000, 512
LINE = re.compile(r"(?:<\d+f>|,)(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>"
                  r"(?:<\|mask;x=(\d+);y=(\d+)(?:;c=[\d.]+)?;data=(\d+),(\d+),(.)(.*?)\|>)?", re.S)


def meta_env() -> dict:
    d = {k: os.environ[k] for k in ("META_API_KEY", "META_BASE_URL") if os.environ.get(k)}
    path = os.path.expanduser("~/.config/ninja/meta.env")
    if len(d) < 2 and os.path.exists(path):
        for line in open(path):
            if "=" in line:
                k, v = line.strip().split("=", 1)
                d.setdefault(k, v.strip().strip('"'))
    return d


def _post(env: dict, path: str, body: dict, timeout: int = 300) -> dict:
    req = urllib.request.Request(env["META_BASE_URL"].rstrip("/") + path, json.dumps(body).encode(), {"content-type": "application/json", "authorization": "Bearer " + env["META_API_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def parse_mask(text: str, w: int, h: int):
    """The largest mask in a SAM 3.1 reply as a full-size boolean array, with its score; None when there is none."""
    from meta_sam_parser import SegmentationMask, decode_mask_to_raster
    best = None
    for m in LINE.finditer(text):
        _, x1, y1, x2, y2, _, _, c, mx, my, mh, mw, enc, payload = m.groups()
        if payload is None:
            continue
        mh, mw = int(mh), int(mw)
        arr = np.frombuffer(decode_mask_to_raster(SegmentationMask("lossless" if enc == "~" else "one_bit", enc + payload, mw, mh)), np.uint8).reshape(mh, mw)
        bw, bh = int(x2) - int(x1), int(y2) - int(y1)
        up = np.asarray(Image.fromarray((arr * 255).astype(np.uint8)).resize((bw, bh), Image.BILINEAR)) > 127
        full = np.zeros((h, w), bool); ox, oy = int(x1), int(y1)
        full[oy:oy + bh, ox:ox + bw] = up[: h - oy, : w - ox]
        o = {"mask": full, "score": float(c) if c else 0.0, "px": int(full.sum())}
        if best is None or o["px"] > best["px"]:
            best = o
    return best


class RouteAMaker(CharacterMaker):
    id = "route-a"
    label = "Muse Image + SAM 3.1 + SAM 3D Objects + our rig"

    def __init__(self, http: Optional[Callable[[dict, str, dict], dict]] = None, lift: Optional[Callable[[bytes, bytes, int], dict]] = None, env: Optional[dict] = None):
        self._http = http or (lambda e, p, b: _post(e, p, b))
        self._lift = lift
        self._env = env

    def env(self) -> dict:
        return self._env if self._env is not None else meta_env()

    def configured(self):
        e = self.env()
        if not (e.get("META_API_KEY") and e.get("META_BASE_URL")):
            return "no Meta key here"
        return None

    # ---- 1 ----
    def picture(self, req) -> Picture:
        t0 = time.time()
        try:
            r = self._http(self.env(), "/images/generations", {"model": "muse-image-1.0", "prompt": f"{req.prompt} {STYLE}", "n": 1, "size": "1024x1536", "output_format": "png"})
            png = base64.b64decode(r["data"][0]["b64_json"])
        except Exception as ex:  # noqa: BLE001
            raise StepFailed(f"picture call failed: {str(ex)[:120]}")
        return Picture(png=png, seconds=round(time.time() - t0, 1), cost_usd=MUSE_USD)

    # ---- 2 ----
    def cutout(self, pic) -> Cutout:
        t0 = time.time()
        im = Image.open(io.BytesIO(pic.png)).convert("RGB")
        jpg = io.BytesIO(); im.save(jpg, "JPEG", quality=92)
        url = "data:image/jpeg;base64," + base64.b64encode(jpg.getvalue()).decode()
        body = {"model": "sam-3.1", "input": [{"role": "user", "content": [{"type": "input_image", "image_url": url}, {"type": "input_text", "text": "character"}]}], "metadata": {"include_confidence": "true"}}
        try:
            r = self._http(self.env(), "/responses", body)
            text = r["output"][0]["content"][0]["text"]
        except Exception as ex:  # noqa: BLE001
            raise StepFailed(f"cut-out call failed: {str(ex)[:120]}")
        best = parse_mask(text, im.width, im.height)
        if best is None or best["px"] < 0.02 * im.width * im.height:
            raise StepFailed("no figure found in the picture")
        buf = io.BytesIO(); Image.fromarray((best["mask"] * 255).astype(np.uint8)).save(buf, "PNG")
        return Cutout(mask_png=buf.getvalue(), score=best["score"], seconds=round(time.time() - t0, 1), cost_usd=SAM_USD)

    # ---- 3 ----
    def _lift_fn(self):
        if self._lift:
            return self._lift
        import modal
        Lift = modal.Cls.from_name("cc-photo-to-object", "Lift")
        return lambda jpeg, mask, seed: Lift().run.remote(jpeg, mask, seed)

    def mesh(self, pic, cut, seed: int, scale: float) -> Baked:
        from ccpipe.padretry import touches_border, pad_bytes  # the path is set by objbake_shim
        img = Image.open(io.BytesIO(pic.png)).convert("RGB")
        msk = Image.open(io.BytesIO(cut.mask_png)).convert("L")
        if scale != 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS); msk = msk.resize(img.size, Image.NEAREST)
        jpg = io.BytesIO(); img.save(jpg, "JPEG", quality=95)
        mp = io.BytesIO(); msk.save(mp, "PNG")
        jpeg, mask = jpg.getvalue(), mp.getvalue()
        if touches_border(np.asarray(msk) > 127):
            jpeg, mask = pad_bytes(jpeg, mask)
        t0 = time.time()
        try:
            r = self._lift_fn()(jpeg, mask, seed)
            raw = np.load(io.BytesIO(r["npz"]))
        except Exception as ex:  # noqa: BLE001
            raise StepFailed(f"lift failed: {str(ex)[:120]}")
        v, f, uv, tex, info = ob.bake_textured(raw["vertices"], raw["faces"], raw["splat_xyz"], raw["splat_dc"], raw["splat_opacity"], "character", 1.75, max_faces=FACES, k=4, texture_size=BAKE_TEX)
        cost = float(r.get("seconds", 0) + r.get("load_seconds", 0)) * L40S_PER_S
        info.update(seed=seed, scale=scale, gpu_seconds=r.get("seconds"), load_seconds=r.get("load_seconds"))
        return Baked(v=v, f=f, uv=uv, tex=tex, info=info, seconds=round(time.time() - t0, 1), cost_usd=round(cost, 4))

    # ---- route C ----
    def fallback(self, pic, cut):
        return route_c.rookie_in_your_colours(pic.png, cut.mask_png if cut else None)
