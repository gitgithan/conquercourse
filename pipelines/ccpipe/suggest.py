"""Suggested things to pick on a photo (CC-248): turn many SAM 3 masks into a short list of clickable regions.

Pure numpy, so it is tested without a GPU. photo_to_object.py runs SAM 3 once per phrase on the privacy-blurred photo and passes the masks here."""
import io

# What people usually want from a park or street photo; one SAM 3 text prompt each. People, faces and plates are blurred before and never offered.
PHRASES = ["bench", "stairs", "railing", "wall", "bollard", "planter", "tree trunk", "log", "pull-up bar", "fence", "picnic table", "slide", "ledge", "box", "pole"]
MAX_ITEMS = 12
MIN_FRAC = 0.002          # a region smaller than this share of the photo is noise
IOU_SAME = 0.6            # two masks this alike are one thing
THUMB = 96                # the small cut-out the page paints over the photo, in pixels on its long side


def box_of(mask):
    import numpy as np
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def iou(a, b):
    import numpy as np
    inter = int(np.logical_and(a, b).sum())
    union = int(np.logical_or(a, b).sum())
    return inter / union if union else 0.0


def pick(cands, shape, limit=MAX_ITEMS):
    """cands: [{label, mask (bool HxW), score}] -> the best, no two the same thing, biggest-first among equals, at most `limit`."""
    h, w = shape
    kept = []
    for c in sorted(cands, key=lambda c: -c["score"]):
        if c["mask"].sum() < MIN_FRAC * h * w:
            continue
        if any(iou(c["mask"], k["mask"]) >= IOU_SAME for k in kept):
            continue
        kept.append(c)
        if len(kept) >= limit:
            break
    return kept


def describe(c):
    """The part the browser gets: label, score, the box in photo pixels, and the cut-out as a small PNG (white where the thing is)."""
    import numpy as np
    from PIL import Image
    box = box_of(c["mask"])
    x0, y0, x1, y1 = box
    crop = c["mask"][y0:y1, x0:x1]
    s = THUMB / max(crop.shape)
    im = Image.fromarray((crop.astype("uint8") * 255)).resize((max(1, round(crop.shape[1] * s)), max(1, round(crop.shape[0] * s))))
    b = io.BytesIO()
    im.save(b, "PNG")
    return {"label": c["label"], "score": round(float(c["score"]), 2), "box": box, "cutout": b.getvalue()}
