"""Computer vision: pick the labelled street-photo set from the COCO val2017 annotations.

usage: lab_vision_pick.py instances_val2017.json picked.json [--n 160]
Keeps images whose Flickr licence is CC BY 2.0 (4) or "no known copyright restrictions" (7), with a street object labelled
(car, bus, truck, bicycle, motorcycle, traffic light, bench, fire hydrant, stop sign, parking meter) and no crowd label.
Seeded shuffle, first N. The output holds only those images and their annotations (a few hundred KB), same layout as the input.
"""
import json, random, sys

STREET = {"car", "bus", "truck", "bicycle", "motorcycle", "traffic light", "bench", "fire hydrant", "stop sign", "parking meter"}

d = json.load(open(sys.argv[1]))
n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 160
cats = {c["id"]: c["name"] for c in d["categories"]}
per = {}
for a in d["annotations"]:
    per.setdefault(a["image_id"], []).append(a)
ok = []
for im in sorted(d["images"], key=lambda x: x["id"]):
    if im["license"] not in (4, 7):
        continue
    anns = per.get(im["id"], [])
    if any(a["iscrowd"] for a in anns):
        continue
    if {cats[a["category_id"]] for a in anns} & STREET:
        ok.append(im)
random.Random(7).shuffle(ok)
ok = ok[:n]
ids = {i["id"] for i in ok}
out = {"categories": d["categories"], "images": ok, "annotations": [a for a in d["annotations"] if a["image_id"] in ids]}
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(ok), "images", len(out["annotations"]), "annotations")
