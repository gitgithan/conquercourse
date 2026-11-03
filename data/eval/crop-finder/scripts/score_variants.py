"""Score every crop-finder variant against the two red boxes (CC-133).

usage: python -I score_variants.py LAB_JSON CLASSIC_JSON OUT_JSON
Per variant: keep candidates (floor, phrase set, views), then score with the same measures as demo-lifts/scripts/finder_vs_red_boxes.py:
  best IoU of one kept box with the red box, and the share of the red box covered by the union of kept boxes (box rectangles, approximate).
Two readings: "bar-labelled" (phrase in the bar set) and "any phrase". A hit needs IoU >= 0.3 (a rough match) - reported, never tuned.
Geometry check (option 10): width >= 120 px, width/height >= 2.5, height <= 160 px."""
import json, sys
SCALE = 1280 / 1010
VIEW = {"loops_top": (450, 208, 820, 296), "left_grid": (45, 272, 320, 335)}
RED = {k: tuple(round(v * SCALE) for v in b) for k, b in VIEW.items()}
BAR_OLD = {"pull-up bar", "monkey bars"}
BAR_NEW = {"overhead ladder", "horizontal ladder", "bar grid", "metal bars", "climbing frame", "overhead bars", "ladder", "gymnastic bars"}
BAR_ALL = BAR_OLD | BAR_NEW
OLD = ["bench", "stairs", "railing", "wall", "bollard", "planter", "tree trunk", "log", "pull-up bar", "fence", "picnic table", "slide", "ledge", "box", "pole", "monkey bars", "string lights"]


def area(b): return max(0, b[2] - b[0]) * max(0, b[3] - b[1])
def inter(a, b): return area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))
def iou(a, b):
    i = inter(a, b); return i / (area(a) + area(b) - i) if i else 0.0
def cover(red, boxes):
    x0, y0, x1, y1 = red; n = 0
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            if any(b[0] <= x < b[2] and b[1] <= y < b[3] for b in boxes): n += 1
    return n / (((x1 - x0 + 1) // 2) * ((y1 - y0 + 1) // 2))
def geom_ok(b):
    w, h = b[2] - b[0], b[3] - b[1]
    return w >= 120 and h > 0 and w / h >= 2.5 and h <= 160


lab = json.load(open(sys.argv[1]))
classic = json.load(open(sys.argv[2]))
V = lab["views"]
def cands(views, phrases, floor, geom=False):
    out = []
    for v in views:
        for c in V[v]["cands"]:
            if c["phrase"] in phrases and c["score"] >= floor and (not geom or geom_ok(c["box"])):
                out.append(c)
    return out
def secs(views): return round(sum(V[v]["seconds"] for v in views), 1)
tiles = [v for v in V if v.startswith("tile_")]
variants = {
    "V0 baseline: full photo, old phrases, floor 0.35": (["full"], OLD, 0.35, False),
    "V0b full photo, old phrases, floor 0.10": (["full"], OLD, 0.10, False),
    "V0c full photo, old phrases, floor 0.10, geometry check": (["full"], OLD, 0.10, True),
    "V1 upper-half crop, old phrases, 0.35": (["upper_half"], OLD, 0.35, False),
    "V1b upper-half crop at 2x, old phrases, 0.35": (["upper_half_x2"], OLD, 0.35, False),
    "V1c region crops (loops + left) at 1x, old phrases, 0.35": (["loops_region", "left_region"], OLD, 0.35, False),
    "V1d region crops at 2x, old phrases, 0.35": (["loops_region_x2", "left_region_x2"], OLD, 0.35, False),
    "V2 full photo at 2x, old phrases, 0.35": (["full_x2"], OLD, 0.35, False),
    "V2b nine 2x tiles, old phrases, 0.35": (tiles, OLD, 0.35, False),
    "V3 full photo, old + new phrases, 0.35": (["full"], OLD + sorted(BAR_NEW), 0.35, False),
    "V3b full photo, old + new phrases, 0.10": (["full"], OLD + sorted(BAR_NEW), 0.10, False),
    "V4 upper-half 2x, old + new phrases, 0.10, geometry check": (["upper_half_x2"], OLD + sorted(BAR_NEW), 0.10, True),
    "V4b upper-half 2x, old + new phrases, 0.35, geometry check": (["upper_half_x2"], OLD + sorted(BAR_NEW), 0.35, True),
    "V4c upper-half 1x, old + new phrases, 0.35, geometry check": (["upper_half"], OLD + sorted(BAR_NEW), 0.35, True),
    "V4d upper-half 2x, old + new phrases, 0.20, geometry check": (["upper_half_x2"], OLD + sorted(BAR_NEW), 0.20, True),
    "V4e full photo, old + new phrases, 0.35, geometry check": (["full"], OLD + sorted(BAR_NEW), 0.35, True),
    "V5 region crops 2x, old + new phrases, 0.10, geometry check": (["loops_region_x2", "left_region_x2"], OLD + sorted(BAR_NEW), 0.10, True),
    "V6 everything (all views, all phrases), 0.10": (list(V), OLD + sorted(BAR_NEW), 0.10, False),
    "V6b everything, 0.10, geometry check": (list(V), OLD + sorted(BAR_NEW), 0.10, True),
    "V6c everything, 0.35, geometry check": (list(V), OLD + sorted(BAR_NEW), 0.35, True),
}
res = {"red_boxes_1280": RED, "variants": {}}
def reading(cs, red, labels):
    boxes = [tuple(c["box"]) for c in cs if labels is None or c["phrase"] in labels]
    best = max(boxes, key=lambda b: iou(red, b), default=None)
    bc = [c for c in cs if best and tuple(c["box"]) == best and (labels is None or c["phrase"] in labels)]
    return {"best_iou": round(iou(red, best), 3) if best else 0, "cover": round(cover(red, boxes), 3) if boxes else 0,
            "best_phrase": bc[0]["phrase"] if bc else None, "best_score": bc[0]["score"] if bc else None, "best_box": list(best) if best else None, "n": len(boxes)}
for name, (views, phrases, floor, geom) in variants.items():
    cs = cands(views, phrases, floor, geom)
    row = {"views": len(views), "seconds_gpu": secs(views), "candidates": len(cs), "red": {}}
    for k, red in RED.items():
        row["red"][k] = {"bar_labelled": reading(cs, red, BAR_ALL), "any_phrase": reading(cs, red, None)}
    res["variants"][name] = row
cl = [dict(label="classic", box=b["box"]) for b in classic["items"]]
res["classic_cv"] = {"seconds_cpu": classic["seconds"], "boxes": [b["box"] for b in classic["items"]],
                     "red": {k: {"best_iou": round(max([iou(red, tuple(b["box"])) for b in classic["items"]] or [0]), 3),
                                 "cover": round(cover(red, [tuple(b["box"]) for b in classic["items"]]), 3)} for k, red in RED.items()}}
def top12(cs, labels, cap=12):
    """what a product list would show: best score first, a box that is 60% the same as a kept one is dropped, at most `cap`; labels=None keeps every phrase."""
    kept = []
    for c in sorted(cs, key=lambda c: -c["score"]):
        if labels is not None and c["phrase"] not in labels: continue
        if any(iou(tuple(c["box"]), tuple(k["box"])) >= 0.6 for k in kept): continue
        kept.append(c)
        if len(kept) >= cap: break
    return kept
for name, (views, phrases, floor, geom) in variants.items():
    cs = cands(views, phrases, floor, geom)
    for key, labels in (("top12_all_phrases", None), ("top12_bar_phrases_only", BAR_ALL)):
        t = top12(cs, labels)
        res["variants"][name][key] = {}
        for k, red in RED.items():
            ious = [iou(red, tuple(c["box"])) for c in t]
            hit = [i for i, v in enumerate(ious) if v >= 0.3]
            res["variants"][name][key][k] = {"best_iou": round(max(ious or [0]), 3), "first_hit_rank": (hit[0] + 1) if hit else None,
                                              "hit_phrase": t[hit[0]]["phrase"] if hit else None, "hit_score": t[hit[0]]["score"] if hit else None}
print()
for n, r in res["variants"].items():
    print(f"{n[:62]:62s} " + " | ".join(f"{key[6:]}: " + " ".join(f"{k[:5]} {v['best_iou']:.2f}@{v['first_hit_rank']}" for k, v in r[key].items()) for key in ("top12_all_phrases", "top12_bar_phrases_only")))
json.dump(res, open(sys.argv[3], "w"), indent=2)
for n, r in res["variants"].items():
    print(f"{n:70s} {r['seconds_gpu']:5.1f}s  n={r['candidates']:3d}  " + "  ".join(
        f"{k}: bar IoU {v['bar_labelled']['best_iou']:.2f} cov {v['bar_labelled']['cover']:.2f} | any IoU {v['any_phrase']['best_iou']:.2f} cov {v['any_phrase']['cover']:.2f}" for k, v in r["red"].items()))
print("classic", res["classic_cv"]["red"])
