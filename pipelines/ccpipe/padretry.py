"""Pad and retry (CC-170): a photo whose object touches the photo edge is never rejected for that alone.

The mask touches the edge  ->  paste photo and mask onto a canvas about 1.5 times as large (edge pixels repeated, mask zeros)
->  mask and lift again once  ->  check the result  ->  if it is still bad, say so in plain words. CPU only; the numbers match CC-145."""
import io

import numpy as np

STRIP = 2           # pixels at each photo edge that count as "the edge" (same as CC-145)
TOUCH = 0.02        # share of one edge that is mask before it counts as touching (CC-145: cut_off)
PAD = 0.25          # padding per side as a share of the photo size: 1 + 2 * 0.25 = a canvas 1.5 times as large

NOTE_PAD = "Your object runs off the edge of the photo. We add space around the photo and try once more."
NOTE_STILL = "It still looks cut off. Try a photo where the whole object is inside the picture, or draw the box yourself."
NOTE_FINE = ""


def border_contact(mask, strip=STRIP):
    """Share of each photo edge (a strip `strip` px wide) that is mask: {'top','bottom','left','right'}."""
    m = np.asarray(mask, bool)
    return {"top": float(m[:strip].mean()), "bottom": float(m[-strip:].mean()),
            "left": float(m[:, :strip].mean()), "right": float(m[:, -strip:].mean())}


def touches_border(mask, thr=TOUCH):
    c = border_contact(mask)
    return max(c.values()) >= thr


def pad_sizes(h, w, frac=PAD):
    """Pixels added on each side (top/bottom, left/right) and the new canvas size (h, w)."""
    py, px = round(h * frac), round(w * frac)
    return py, px, h + 2 * py, w + 2 * px


def pad_arrays(img, mask, frac=PAD):
    """The photo with edge pixels repeated and the mask with zeros, both on the larger canvas."""
    py, px, _, _ = pad_sizes(img.shape[0], img.shape[1], frac)
    return (np.pad(img, ((py, py), (px, px), (0, 0)), mode="edge"),
            np.pad(np.asarray(mask), ((py, py), (px, px)), mode="constant"))


def pad_bytes(jpeg, mask_png, frac=PAD):
    from PIL import Image
    img = np.asarray(Image.open(io.BytesIO(jpeg)).convert("RGB"))
    m = np.asarray(Image.open(io.BytesIO(mask_png)).convert("L"))
    pi, pm = pad_arrays(img, m, frac)
    bi, bm = io.BytesIO(), io.BytesIO()
    Image.fromarray(pi).save(bi, "JPEG", quality=95)
    Image.fromarray(pm).save(bm, "PNG")
    return bi.getvalue(), bm.getvalue()


def still_bad(info, lo=0.5, hi=2.0, ref_aspect=None):
    """After the retry: a lift whose width/height shape is far from the shape of the mask is bad (a wall lifted as a table).

    `info` needs 'extent_aspect' (mesh width over height) and 'mask_aspect' (mask box width over height); `ref_aspect` overrides the mask's."""
    want = ref_aspect if ref_aspect is not None else info["mask_aspect"]
    ratio = info["extent_aspect"] / want if want else 1.0
    return not (lo <= ratio <= hi)


def decide(first_touches, retried, bad_after):
    """The note for the player: 'pad' (we padded and it is fine), 'still' (padded and still bad), '' (nothing to say)."""
    if not first_touches:
        return ""
    return "still" if retried and bad_after else "pad"


def lift_check(npz_bytes, mask_png):
    """Judge a raw lift (z up): the mesh width over height against the mask box width over height. Returns the numbers and 'bad'."""
    from PIL import Image
    from ccpipe.objmask import mask_box
    v = np.load(io.BytesIO(npz_bytes))["vertices"]
    ext = v.max(0) - v.min(0)
    width, height = float(max(ext[0], ext[1])), float(ext[2])
    mb = mask_box(np.asarray(Image.open(io.BytesIO(mask_png)).convert("L")) > 127)
    mask_aspect = (mb[2] - mb[0]) / (mb[3] - mb[1])
    info = {"extent_aspect": round(width / max(height, 1e-9), 3), "mask_aspect": round(mask_aspect, 3)}
    info["bad"] = bool(still_bad(info))
    return info
