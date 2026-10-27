"""Fit segmented obstacles to obstacle primitives with metric sizes (schema: course/primitives.schema.json, docs/primitives.md).

Pixels become metres through a scale; every fit keeps the scale source and a relative uncertainty so nobody mistakes a guess for a measurement.
A side view is assumed (the camera looks across the run): height and run are measured, width is not visible and falls back to a typical value."""
import math

import numpy as np

SCHEMA_VERSION = "0.1.0"
ADULT_HEIGHT_M = 1.75
ADULT_HEIGHT_REL = 0.06          # adults stand 1.6-1.9 m: about 6 % (1 sigma)
PIXEL_SLOP = 2.0                 # a mask edge is good to about 2 px
TYPICAL_WIDTH_M = 2.0            # across the run, not visible in a side view
TYPICAL_BAR_DIAMETER_M = 0.04

# first match wins: (words in the noun phrase, primitive type, roles, extra)
PHRASE_RULES = [
    (("trampoline", "spring"), "spring", ["stand"], {}),
    (("curved wall", "warped wall", "quarter pipe", "curve"), "ramp", ["stand", "grab"], {"profile": "arc"}),
    (("ramp", "slope", "incline"), "ramp", ["stand"], {"profile": "line"}),
    (("rope",), "ropeAnchor", ["grab"], {}),
    (("bar", "rail", "handrail", "pole", "pipe"), "bar", ["grab"], {}),
    (("water", "pool", "pond"), "water", ["hazard"], {}),
    (("wall", "fence", "barrier"), "wall", ["vault", "grab"], {}),
    (("platform", "box", "ledge", "block", "step", "stairs", "bench", "stand"), "platform", ["stand"], {}),
]


def primitive_for_phrase(phrase):
    p = phrase.lower()
    for words, ptype, roles, extra in PHRASE_RULES:
        if any(w in p for w in words):
            return ptype, list(roles), dict(extra)
    return None


# ---- scale ----
def scale_known_height(height_m, height_px, rel=0.04, note=""):
    """Metres per pixel from an object of known size in the picture (for example the 4.3 m warped wall)."""
    return {"source": "known-height", "metresPerPixel": height_m / height_px,
            "relativeUncertainty": math.hypot(rel, PIXEL_SLOP / height_px), "note": note or f"object of {height_m} m is {height_px:.0f} px tall"}


def scale_body_height(person_px, assumed_m=ADULT_HEIGHT_M, rel=ADULT_HEIGHT_REL, depth_rel=0.05):
    """Metres per pixel at the athlete's depth from the athlete's standing height; an obstacle at another depth is off by `depth_rel` more."""
    return {"source": "body-height", "metresPerPixel": assumed_m / person_px,
            "relativeUncertainty": math.sqrt(rel ** 2 + depth_rel ** 2 + (PIXEL_SLOP / person_px) ** 2),
            "note": f"athlete {person_px:.0f} px tall taken as {assumed_m} m (adult range 1.6-1.9 m); obstacle assumed at the athlete's depth"}


def scale_contact_height(contact_m, contact_px, rel=0.12):
    """Metres per pixel from a measured hand or foot height on the obstacle (the body model gives metres; vertical scale is its weak part)."""
    return {"source": "contact-height", "metresPerPixel": contact_m / contact_px,
            "relativeUncertainty": math.hypot(rel, PIXEL_SLOP / contact_px), "note": "from a contact point's height in metres and its pixel height above the floor"}


# ---- geometry ----
def fit_circle(points):
    """Least-squares circle (Kasa) through (N, 2) points: returns (cx, cy, r)."""
    p = np.asarray(points, float)
    a = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
    b = (p ** 2).sum(axis=1)
    (cx, cy, c), *_ = np.linalg.lstsq(a, b, rcond=None)
    return float(cx), float(cy), float(math.sqrt(max(c + cx ** 2 + cy ** 2, 0.0)))


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def merge_detections(dets, min_iou=0.5):
    """One object per phrase and place: detections of the same phrase on different frames with overlapping boxes are merged (best score kept, frames listed)."""
    out = []
    for d in sorted(dets, key=lambda d: -(d.get("score") or 0)):
        for o in out:
            if o["phrase"] == d["phrase"] and iou(o["box"], d["box"]) >= min_iou:
                o["frames"] = sorted(set(o["frames"]) | set(d["frames"]))
                break
        else:
            out.append({**d, "frames": sorted(set(d["frames"]))})
    return out


def _rel(scale, size_px):
    return round(math.hypot(scale["relativeUncertainty"], PIXEL_SLOP / max(size_px, 1.0)), 3)


TYPICAL_THICKNESS_M = 0.3
TYPICAL_RUN_M = 2.0


def fit(det, scale, floor_row_px, edge_points_px=None, idx=1, view="side"):
    """One detection {phrase, score, box [x1,y1,x2,y2], mask_px, frames} to a primitive dict, or None when the phrase maps to no primitive.

    floor_row_px: image row of the floor under the obstacle (from the athlete's feet); heights are measured up from it.
    view: "side" (the camera looks across the run: horizontal sizes are metric) or "oblique" (horizontal sizes are not trusted and fall back to typical values)."""
    rule = primitive_for_phrase(det["phrase"])
    if rule is None:
        return None
    ptype, roles, extra = rule
    mpp = scale["metresPerPixel"]
    x1, y1, x2, y2 = det["box"]
    w_px, h_px = x2 - x1, y2 - y1
    top_px = max(floor_row_px - y1, 1.0)
    notes, unc = [], {}
    side = view == "side"
    if not side:
        notes.append("oblique view: the horizontal sizes are typical values, only the height is measured")
        w_px = None
    if ptype == "wall":
        sizes = {"height": top_px * mpp, "width": TYPICAL_WIDTH_M, "thickness": max(w_px * mpp, 0.05) if side else TYPICAL_THICKNESS_M}
        unc = {"height": _rel(scale, top_px), "thickness": _rel(scale, w_px) if side else 0.5}
        notes.append(f"width {TYPICAL_WIDTH_M} m is a typical value (not visible in a side view)")
    elif ptype == "ramp":
        sizes = {"height": top_px * mpp, "run": w_px * mpp if side else TYPICAL_RUN_M, "width": TYPICAL_WIDTH_M, "profile": extra["profile"]}
        unc = {"height": _rel(scale, top_px), "run": _rel(scale, w_px) if side else 0.5}
        notes.append(f"width {TYPICAL_WIDTH_M} m is a typical value (not visible in a side view)")
        if extra["profile"] == "arc":
            if edge_points_px is not None and len(edge_points_px) >= 10 and side:
                _, _, r_px = fit_circle(edge_points_px)
                sizes["radius"] = r_px * mpp
                unc["radius"] = max(_rel(scale, r_px), 0.15)
                notes.append("radius fitted to the mask's curved edge")
            else:
                sizes["radius"] = max(top_px, w_px or 0) * mpp
                unc["radius"] = 0.35
                notes.append("radius guessed as the larger of height and run (a quarter-circle-like curve); no edge points")
    elif ptype == "platform":
        sizes = {"length": w_px * mpp if side else TYPICAL_RUN_M, "width": TYPICAL_WIDTH_M, "height": top_px * mpp}
        unc = {"length": _rel(scale, w_px) if side else 0.5, "height": _rel(scale, top_px)}
        notes.append(f"width {TYPICAL_WIDTH_M} m is a typical value (not visible in a side view)")
    elif ptype == "bar":
        mid = floor_row_px - (y1 + y2) / 2
        sizes = {"height": max(mid, 1.0) * mpp, "length": max(w_px or 0, h_px) * mpp if side else TYPICAL_WIDTH_M, "diameter": TYPICAL_BAR_DIAMETER_M,
                 "orientation": "across" if (not side or h_px > 1.5 * w_px) else "along"}
        unc = {"height": _rel(scale, mid), "length": _rel(scale, max(w_px or 0, h_px)) if side else 0.5}
        notes.append("diameter is a typical value")
    elif ptype == "ropeAnchor":
        sizes = {"anchorHeight": top_px * mpp, "ropeLength": h_px * mpp}
        unc = {"anchorHeight": _rel(scale, top_px), "ropeLength": _rel(scale, h_px)}
    elif ptype == "water":
        sizes = {"length": w_px * mpp if side else TYPICAL_RUN_M, "width": TYPICAL_WIDTH_M}
        unc = {"length": _rel(scale, w_px) if side else 0.5}
    else:   # spring
        sizes = {"width": TYPICAL_WIDTH_M, "restHeight": top_px * mpp, "stiffness": 20000.0}
        unc = {"restHeight": _rel(scale, top_px), "stiffness": 1.0}
        notes.append("stiffness is a placeholder (not measurable from a picture)")
    sizes = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in sizes.items()}
    prim = {"id": f"{ptype}-{idx}", "type": ptype, "roles": roles, "sizes": sizes,
            "scale": {k: (round(v, 6) if isinstance(v, float) else v) for k, v in scale.items()},
            "sizeUncertainty": unc,
            "fit": {"phrase": det["phrase"], "score": det.get("score"), "boxPx": [round(float(v), 1) for v in det["box"]],
                    "maskPx": det.get("mask_px"), "frames": det.get("frames", []), "note": "; ".join(notes)}}
    if ptype == "bar":
        prim["status"] = "proposed"
    prim["fit"] = {k: v for k, v in prim["fit"].items() if v not in (None, "", [])}
    return prim


def keep_best(dets, image_px, min_area_frac=0.004, max_per_phrase=3):
    """Drop specks (mask under `min_area_frac` of the picture) and keep the `max_per_phrase` biggest-and-best objects per phrase."""
    big = [d for d in dets if (d.get("mask_px") or 0) >= min_area_frac * image_px]
    out = []
    for ph in sorted({d["phrase"] for d in big}):
        group = sorted((d for d in big if d["phrase"] == ph), key=lambda d: -(d["mask_px"] * (d.get("score") or 0)))
        out += group[:max_per_phrase]
    return out


def fit_all(dets, scale, floor_row_px, edges=None, view="side"):
    """Merge detections, fit each, number the ids per type. `edges` maps (phrase, box tuple) to edge points."""
    prims, count = [], {}
    for d in merge_detections(dets):
        ep = (edges or {}).get((d["phrase"], tuple(d["box"])))
        ptype = (primitive_for_phrase(d["phrase"]) or (None,))[0]
        if ptype is None:
            continue
        count[ptype] = count.get(ptype, 0) + 1
        prims.append(fit(d, scale, floor_row_px, ep, count[ptype], view))
    return prims


def gaps_between(platforms, min_span=0.3):
    """Gap primitives from platforms placed along the run (each needs pose.z and sizes.length): the empty stretch between neighbours."""
    ps = sorted((p for p in platforms if p["type"] == "platform" and "pose" in p), key=lambda p: p["pose"]["z"])
    out = []
    for a, b in zip(ps, ps[1:]):
        span = (b["pose"]["z"] - b["sizes"]["length"] / 2) - (a["pose"]["z"] + a["sizes"]["length"] / 2)
        if span >= min_span:
            out.append({"id": f"gap-{len(out) + 1}", "type": "gap", "roles": ["hazard"],
                        "sizes": {"span": round(span, 3), "drop": round(b["sizes"]["height"] - a["sizes"]["height"], 3)},
                        "fit": {"note": f"between {a['id']} and {b['id']}"}})
    return out


def check_with_contacts(prim, contacts, floor_m=0.0):
    """Compare a fitted obstacle's top with the highest hand contact on obstacles (metres above the floor).

    A hand can't hold above the top, so hand_max much above the fitted top means the scale or the fit is off."""
    hands = [c["point"][1] - floor_m for c in contacts if c["kind"] == "obstacle" and c["joint"].endswith("Hand")]
    top = prim["sizes"].get("height", prim["sizes"].get("anchorHeight", prim["sizes"].get("restHeight")))
    if not hands or top is None:
        return {"checked": False, "why": "no hand contact on an obstacle"}
    hmax = max(hands)
    return {"checked": True, "highest_hand_m": round(hmax, 3), "fitted_top_m": top, "difference_m": round(hmax - top, 3),
            "consistent": bool(hmax <= top * (1 + 2 * (prim["sizeUncertainty"].get("height", 0.15))) + 0.1)}
