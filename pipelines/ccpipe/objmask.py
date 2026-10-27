"""Choose the mask for an object from SAM 3's candidates and the box the maker drew (CPU)."""
import numpy as np


def mask_box(mask):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def pick_mask(candidates, box, min_iou=0.3):
    """candidates: [{'mask': bool array, 'score': float}]. The one whose bounding box overlaps `box` most (ties: higher score).

    Returns (index, iou) or (None, 0.0) when none overlaps by at least min_iou (the caller falls back to a box prompt)."""
    best, best_key = None, None
    for i, c in enumerate(candidates):
        mb = mask_box(c["mask"])
        if mb is None:
            continue
        o = iou(mb, box)
        key = (round(o, 3), c.get("score", 0.0))
        if o >= min_iou and (best_key is None or key > best_key):
            best, best_key = i, key
    return (best, best_key[0]) if best is not None else (None, 0.0)


def box_mask(shape, box):
    """The fallback: the whole box as a mask."""
    m = np.zeros(shape, bool)
    x0, y0, x1, y1 = (int(round(v)) for v in box)
    m[max(0, y0):y1, max(0, x0):x1] = True
    return m
