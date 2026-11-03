"""How much do the Segment Objects outlines on photo 2 overlap the product owner's two red boxes? (CC-133)

usage: python -I finder_vs_red_boxes.py SUGGEST_JSON OUT_JSON

Coordinates are pixels of the 1280x960 picture the finder saw (the same size as evidence/photo2_segment_objects.jpg).
The red boxes were read by eye from a copy of that picture shown at about 1010x760, so they are rescaled by 1280/1010 and are only approximate (a few pixels either way).
Boxes only: the cut-out masks are not tracked, so a thin vertical pole box counts its whole rectangle, which is more than the pole itself covers."""
import json, sys

SCALE = 1280 / 1010
VIEW = {"loops_top": (450, 208, 820, 296), "left_grid": (45, 272, 320, 335)}
RED = {k: tuple(round(v * SCALE) for v in b) for k, b in VIEW.items()}
LAB_BOX_SENT = (551, 288, 1222, 349)  # the box the lab drew for the lift (lifts/p2_monkey_bars/lift.json, box_sent)


def area(b):
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def inter(a, b):
    return area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))


def union_cover(red, boxes):
    """share of the red box covered by at least one finder box (pixel count on a grid)."""
    x0, y0, x1, y1 = red
    n = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if any(b[0] <= x < b[2] and b[1] <= y < b[3] for b in boxes):
                n += 1
    return n / area(red)


items = json.load(open(sys.argv[1]))["items"]
out = {"scale_from_view": SCALE, "red_boxes_1280": RED, "lab_box_sent": LAB_BOX_SENT, "red": {}}
for name, red in RED.items():
    rows = []
    for it in items:
        b = tuple(it["box"])
        i = inter(red, b)
        rows.append({"label": it["label"], "score": it["score"], "box": list(b), "inter_px": i,
                     "share_of_red_box": round(i / area(red), 3), "iou": round(i / (area(red) + area(b) - i), 4)})
    by_label = {}
    for lab in sorted({r["label"] for r in rows}):
        by_label[lab] = round(union_cover(red, [tuple(r["box"]) for r in rows if r["label"] == lab]), 3)
    out["red"][name] = {
        "box": list(red),
        "best_iou": max(r["iou"] for r in rows),
        "all_finder_boxes_cover_share": round(union_cover(red, [tuple(i["box"]) for i in items]), 3),
        "cover_share_by_label": by_label,
        "bar_labels_only_cover_share": round(union_cover(red, [tuple(i["box"]) for i in items if i["label"] in ("pull-up bar", "monkey bars")]), 3),
        "rows_touching": [r for r in rows if r["inter_px"] > 0],
        "lab_box_covers_share": round(inter(red, LAB_BOX_SENT) / area(red), 3),
    }
json.dump(out, open(sys.argv[2], "w"), indent=2)
for k, v in out["red"].items():
    print(k, v["box"], "best IoU", v["best_iou"], "all boxes cover", v["all_finder_boxes_cover_share"], "by label", v["cover_share_by_label"], "bar-labels", v["bar_labels_only_cover_share"], "lab box covers", v["lab_box_covers_share"])
