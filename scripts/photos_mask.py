"""CC-90: mask every person in the candidate street photos instead of rejecting the photo, and measure what is left.

usage: photos_mask.py SLUG [SLUG ...] [--max 120]   (repo root, /root/venv-det/bin/python; token in ~/.config/ninja/mapillary.env, never printed)
Uses the same candidates as photos_people.py (photos along the lane that face it). A person is found by torchvision Mask R-CNN
(ResNet-50 FPN, COCO weights; code BSD-3-Clause, labels CC BY 4.0), on the photo and on its mirror image (a person missed one way is often seen the other).
The whole silhouette is covered (not only the face): the mask is grown by a few pixels and filled from a heavily blurred copy.
Masked pictures go to ~/photos-masked (not the repo). The repo gets only numbers and a small contact sheet.
A photo is usable when at most 15 percent of it is masked and no person box is larger than 25 percent of the picture.
"""
import json, os, sys, time
sys.path.insert(0, "scripts")
import torch, torchvision
import torch.nn.functional as F
from PIL import Image, ImageFilter
import photos_people as pp

SCORE, MAX_MASKED, MAX_BOX = 0.3, 0.15, 0.25
OUT = os.path.expanduser("~/photos-masked")


def person_masks(model, img):
    to_t = torchvision.transforms.functional.to_tensor
    t = to_t(img)
    res = []
    for flip in (False, True):
        x = t.flip(-1) if flip else t
        with torch.no_grad():
            r = model([x])[0]
        for l, s, b, m in zip(r["labels"], r["scores"], r["boxes"], r["masks"]):
            if int(l) == 1 and float(s) >= SCORE:
                m = (m[0] > 0.5)
                b = b.clone()
                if flip:
                    m = m.flip(-1)
                    b[0], b[2] = t.shape[-1] - b[2], t.shape[-1] - b[0]
                res.append((float(s), b, m))
    return res


def mask_photo(img, persons):
    w, h = img.size
    union = torch.zeros((h, w), dtype=torch.bool)
    for _, _, m in persons:
        union |= m
    r = int(4 + 0.006 * w)
    grown = F.max_pool2d(union[None, None].float(), 2 * r + 1, 1, r)[0, 0] > 0
    share = float(grown.float().mean())
    mask_img = Image.fromarray((grown.numpy() * 255).astype("uint8"))
    blurred = img.filter(ImageFilter.GaussianBlur(max(w, h) / 22))
    out = Image.composite(blurred, img, mask_img)
    return out, share


def main(slugs, cap):
    torch.set_num_threads(int(os.environ.get("THREADS", os.cpu_count() or 4)))
    model = torchvision.models.detection.maskrcnn_resnet50_fpn(weights=torchvision.models.detection.MaskRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
    os.makedirs("data/eval/cc-90-photos/masking", exist_ok=True)
    for slug in slugs:
        os.makedirs(f"{OUT}/{slug}", exist_ok=True)
        pl = json.load(open(f"public/assets/places/{slug}.json"))
        cands, in_box, facing, steps = pp.candidates(pl, cap)
        rows, t0 = [], time.time()
        for i, p in enumerate(cands):
            pid = p["im"]["id"]
            try:
                img = pp.load_image(p)
            except Exception:
                rows.append({"id": pid, "usable": False, "reason": "download failed"}); continue
            persons = person_masks(model, img)
            w, h = img.size
            box_max = max(((float(b[2] - b[0]) * float(b[3] - b[1])) / (w * h) for _, b, _ in persons), default=0.0)
            out, share = mask_photo(img, persons) if persons else (img, 0.0)
            usable = share <= MAX_MASKED and box_max <= MAX_BOX
            reason = "" if usable else ("person box over 25 percent of the picture" if box_max > MAX_BOX else "more than 15 percent masked")
            if persons:
                out.save(f"{OUT}/{slug}/{pid}.jpg", quality=85)
            rows.append({"id": pid, "persons": len(persons), "masked_share": round(share, 4), "person_box_max_share": round(box_max, 4), "usable": usable, "reason": reason,
                         "had_person": bool(persons), "creator": (p["im"].get("creator") or {}).get("username", ""), "lat": round(p["lat"], 6), "lon": round(p["lon"], 6)})
            if i % 10 == 0:
                print(slug, i, "of", len(cands), round(time.time() - t0), "s", flush=True)
        n = len(rows)
        clean = sum(1 for r in rows if r.get("usable") and not r.get("had_person"))
        masked_ok = sum(1 for r in rows if r.get("usable") and r.get("had_person"))
        stats = {"place": slug, "lane_steps_10m": steps, "candidates_checked": n, "usable_no_person_found": clean, "usable_after_masking": masked_ok,
                 "usable_total": clean + masked_ok, "dropped": n - clean - masked_ok,
                 "masked_share_median_of_masked": sorted(r["masked_share"] for r in rows if r.get("had_person"))[len([1 for r in rows if r.get("had_person")]) // 2] if any(r.get("had_person") for r in rows) else 0,
                 "detector": f"torchvision maskrcnn_resnet50_fpn COCO, person score >= {SCORE}, photo plus mirror image", "rows": rows}
        json.dump(stats, open(f"data/eval/cc-90-photos/masking/{slug}-mask.json", "w"), indent=2)
        open(f"data/eval/cc-90-photos/masking/{slug}-mask.json", "a").write("\n")
        print(slug, json.dumps({k: v for k, v in stats.items() if k != "rows"}), flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cap = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 120
    if "--max" in sys.argv:
        args.remove(str(cap))
    main(args, cap)
