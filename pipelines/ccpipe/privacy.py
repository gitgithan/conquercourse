"""Privacy first, on a photo (CPU): people blurred, faces and licence plates pixelated, before any other model sees it.

SAM 3 finds the masks (on Modal); this module only edits pixels and counts what it hid. A recognisable face never leaves."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

PERSON_T, FACE_T, PLATE_T = 0.5, 0.4, 0.4  # score thresholds, as in pipeline 1


def grow(mask, px):
    """Dilate a boolean mask by px pixels (a disc)."""
    if px <= 0:
        return mask.copy()
    r = np.arange(-px, px + 1)
    disc = (r[:, None] ** 2 + r[None, :] ** 2) <= px * px
    return ndimage.binary_dilation(mask, structure=disc)


def pixelate(img, mask, block):
    """Replace the masked pixels by block-sized flat squares."""
    h, w = mask.shape
    small = Image.fromarray(img).resize((max(1, w // block), max(1, h // block)), Image.BOX)
    pix = np.asarray(small.resize((w, h), Image.NEAREST))
    out = img.copy()
    out[mask] = pix[mask]
    return out


def blur(img, mask, sigma):
    out = img.copy()
    soft = np.asarray(Image.fromarray(img).filter(ImageFilter.GaussianBlur(sigma)))
    out[mask] = soft[mask]
    return out


def apply_privacy(img, people, faces, plates):
    """img: uint8 (h, w, 3). people, faces, plates: lists of boolean masks. Returns (masked image, receipt of counts).

    People are blurred (sigma at least 8 px or 2 % of the longer side), then faces and plates pixelated on top."""
    img = np.asarray(img, np.uint8)
    h, w = img.shape[:2]
    longer = max(h, w)
    out = img
    if people:
        pm = np.zeros((h, w), bool)
        for m in people:
            pm |= grow(m, max(4, round(0.008 * longer)))
        out = blur(out, pm, max(8, 0.02 * longer))
    g = max(3, round(0.004 * longer))
    for m in list(faces) + list(plates):
        ys, xs = np.nonzero(m)
        if len(xs) == 0:
            continue
        out = pixelate(out, grow(m, g), max(8, int((xs.max() - xs.min() + 1) // 6)))
    return out, {"people": len(people), "faces": len(faces), "plates": len(plates), "changed": bool(people or faces or plates)}


def mask_boxes(masks, limit=60):
    """Boxes [x0, y0, x1, y1] (whole pixels) round boolean masks; empty masks are skipped. Used to tell the page where people and faces are."""
    out = []
    for m in masks:
        ys, xs = np.nonzero(m)
        if len(xs):
            out.append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1])
    return out[:limit]
