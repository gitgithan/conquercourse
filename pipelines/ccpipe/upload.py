"""Checks for a player's photo upload (CC-221): the box, the label and the typed height, before any GPU is paid for.

Pure and small; the web function in pipelines/photo_to_object.py calls `check`, and the site's server applies the same limits (functions/api/object-lift.ts)."""
import re

MAX_BYTES = 3_000_000       # a shrunk jpeg from the browser is about 300 KB to 1 MB
MAX_SIDE = 2400
MIN_SIDE = 200
MIN_BOX = 24                # pixels, each side
LABEL_RE = re.compile(r"^[a-z][a-z \-]{1,29}$")


def check(jpeg, label, box, height_m, size):
    """(clean, why): the cleaned label, box and height, or a short plain reason it was refused."""
    if len(jpeg) > MAX_BYTES:
        return None, "the photo is too big"
    if jpeg[:3] != b"\xff\xd8\xff":
        return None, "the photo must be a jpeg"
    w, h = size
    if not (MIN_SIDE <= min(w, h) and max(w, h) <= MAX_SIDE):
        return None, "the photo size is not allowed"
    lab = re.sub(r"\s+", " ", str(label or "").strip().lower())
    if not LABEL_RE.match(lab):
        return None, "say what it is in a few letters (for example: bench)"
    try:
        b = [int(round(float(v))) for v in box]
    except (TypeError, ValueError):
        return None, "bad box"
    if len(b) != 4 or not (0 <= b[0] < b[2] <= w and 0 <= b[1] < b[3] <= h) or b[2] - b[0] < MIN_BOX or b[3] - b[1] < MIN_BOX:
        return None, "the box must sit inside the photo and not be tiny"
    hm = None
    if height_m not in (None, ""):
        try:
            hm = float(height_m)
        except (TypeError, ValueError):
            return None, "bad height"
        if not 0.1 <= hm <= 6:
            return None, "the height must be between 0.1 and 6 metres"
    return {"label": lab, "box": b, "height_m": hm}, None
