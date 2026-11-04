"""Computer vision: per-photo detector scores for the labelled street-photo set.

usage: lab_vision_scores.py PICKED_JSON OUT_DIR (the output of lab_vision_pick.py) [--n 160]   (repo root, venv with torch and torchvision)
Photos: the picks of lab_vision_pick.py (COCO val2017, CC BY 2.0 or no known copyright restrictions, street scenes, no crowd label).
Truth: the COCO person boxes written by people (area at least 0.05 percent of the photo).
Detector: the same Mask R-CNN and the same person_masks() (photo plus mirror) as scripts/photos_mask.py, but with the score floor
lowered to 0.05 so the page can sweep the score cut. Duplicate finds (photo and mirror) are merged by box overlap.
Mask share per find: the grown mask (same growth as photos_mask.mask_photo) as a share of the photo.
`u30` is the share of the whole union of finds scored 0.3 or more, grown, from the real mask_photo(): the number the shipped rule uses.
Output: scores.json (the table the page loads), thumbs/ (all photos at 160 px wide), meta.json (credits).
"""
import json, os, random, sys
sys.path.insert(0, "scripts")
import torch, torchvision
import torch.nn.functional as F
from PIL import Image
import urllib.request
import photos_mask as pm

STREET = {"car", "bus", "truck", "bicycle", "motorcycle", "traffic light", "bench", "fire hydrant", "stop sign", "parking meter"}
FLOOR = 0.05


def iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u > 0 else 0.0


def grown_of(m, w):
    r = int(4 + 0.006 * w)
    return F.max_pool2d(m[None, None].float(), 2 * r + 1, 1, r)[0, 0] > 0


def main(inst_path, out, n):
    pm.SCORE = FLOOR
    d = json.load(open(inst_path))
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
        names = {cats[a["category_id"]] for a in anns}
        if names & STREET:
            ok.append(im)
    ok = ok[:n]
    os.makedirs(f"{out}/thumbs", exist_ok=True)
    model = torchvision.models.detection.maskrcnn_resnet50_fpn(weights=torchvision.models.detection.MaskRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
    torch.set_num_threads(int(os.environ.get("THREADS", 8)))
    rows, meta = [], []
    for k, im in enumerate(ok):
        path = f"{out}/img_{im['id']}.jpg"
        if not os.path.exists(path):
            urllib.request.urlretrieve(im["coco_url"], path)
        img = Image.open(path).convert("RGB")
        w, h = img.size
        found = pm.person_masks(model, img)
        found.sort(key=lambda t: -t[0])
        merged = []
        for s, b, m in found:
            bb = [float(v) for v in b]
            dup = next((x for x in merged if iou(x[1], bb) > 0.5), None)
            if dup:
                dup[2] = dup[2] | m
            else:
                merged.append([s, bb, m])
        dets = []
        for s, bb, m in merged:
            share = float(grown_of(m, w).float().mean())
            box = max(0.0, bb[2] - bb[0]) * max(0.0, bb[3] - bb[1]) / (w * h)
            dets.append([round(s, 3), round(box, 4), round(share, 4)])
        big = [m for s, bb, m in merged if s >= 0.3]
        u30 = 0.0
        if big:
            u = torch.zeros((h, w), dtype=torch.bool)
            for m in big:
                u |= m
            u30 = float(grown_of(u, w).float().mean())
        gts = []
        for a in per[im["id"]]:
            if cats[a["category_id"]] != "person":
                continue
            x, y, bw, bh = a["bbox"]
            sz = bw * bh / (w * h)
            if sz < 0.0005:
                continue
            gb = [x, y, x + bw, y + bh]
            best, bi = 0.0, -1
            for i, (s, bb, m) in enumerate(merged):
                v = iou(gb, bb)
                if v > best:
                    best, bi = v, i
            gts.append([round(sz, 4), bi if best >= 0.5 else -1])
        rows.append({"id": im["id"], "det": dets, "gt": gts, "u30": round(u30, 4)})
        meta.append({"id": im["id"], "license": im["license"], "flickr_url": im["flickr_url"], "w": w, "h": h})
        t = img.copy(); t.thumbnail((160, 160)); t.save(f"{out}/thumbs/{im['id']}.jpg", quality=55)
        if k % 10 == 0:
            print(k, "of", len(ok), flush=True)
    json.dump({"detector": f"torchvision maskrcnn_resnet50_fpn COCO weights, photo plus mirror, score floor {FLOOR}", "photos": rows}, open(f"{out}/scores.json", "w"), indent=2)
    json.dump(meta, open(f"{out}/meta.json", "w"), indent=2)


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 160
    if "--n" in sys.argv:
        a.remove(str(n))
    main(a[0], a[1], n)
