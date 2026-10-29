"""CC-90: the safe photo allow-list. A street photo is kept only when masking people worked, checked twice.
usage: photos_safe.py SLUG [SLUG ...] [--max 120] (repo root, /root/venv-det/bin/python; token in ~/.config/ninja/mapillary.env, read by code, never printed)
Reject a photo when:
  - more than 15 percent of it is masked, or one person box is over 25 percent of it (photos_mask.py rules);
  - a second detector (Faster R-CNN, person score >= 0.5), run on the original and on the masked picture, finds a person that the mask does not cover.
    A found box counts as covered when at least 60 percent of it lies inside the grown mask (the grey smudge itself is then not a miss).
Masking happens at build time here (mask_photo from photos_mask.py is the same function a proxy would call on the fly); masked pictures go to ~/photos-masked, never into the repo.
The repo gets only the allow-list (ids, credit, place, mask numbers).
"""
import json, os, sys, time
sys.path.insert(0, "scripts")
import torch, torchvision
import torch.nn.functional as F
import photos_people as pp
import photos_mask as pm

COVER = 0.6
OUTD = "data/eval/cc-90-photos/masking"


def grown_mask(persons, w, h):
    union = torch.zeros((h, w), dtype=torch.bool)
    for _, _, m in persons:
        union |= m
    r = int(4 + 0.006 * w)
    return F.max_pool2d(union[None, None].float(), 2 * r + 1, 1, r)[0, 0] > 0


def uncovered(det, img, grown):
    """Person boxes the second detector finds that the mask does not mostly cover."""
    t = torchvision.transforms.functional.to_tensor(img)
    with torch.no_grad():
        o = det([t])[0]
    left = []
    for l, s, b in zip(o["labels"], o["scores"], o["boxes"]):
        if int(l) != 1 or float(s) < 0.5:
            continue
        x0, y0, x1, y1 = [int(v) for v in b]
        box = grown[y0:y1 + 1, x0:x1 + 1]
        cov = float(box.float().mean()) if box.numel() else 1.0
        if cov < COVER:
            left.append({"score": round(float(s), 2), "cover": round(cov, 2), "box_share": round((x1 - x0) * (y1 - y0) / (img.width * img.height), 4)})
    return left


def main(slugs, cap):
    torch.set_num_threads(int(os.environ.get("THREADS", os.cpu_count() or 4)))
    tv = torchvision.models.detection
    seg = tv.maskrcnn_resnet50_fpn(weights=tv.MaskRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
    det = tv.fasterrcnn_resnet50_fpn(weights=tv.FasterRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
    os.makedirs(OUTD, exist_ok=True)
    summary = []
    for slug in slugs:
        os.makedirs(f"{pm.OUT}/{slug}", exist_ok=True)
        pl = json.load(open(f"public/assets/places/{slug}.json"))
        cands, _, _, steps = pp.candidates(pl, cap)
        rows, t0 = [], time.time()
        for i, p in enumerate(cands):
            pid = p["im"]["id"]
            row = {"id": pid, "creator": (p["im"].get("creator") or {}).get("username", ""), "lat": round(p["lat"], 6), "lon": round(p["lon"], 6)}
            try:
                img = pp.load_image(p)
            except Exception:
                rows.append({**row, "keep": False, "reason": "download failed"}); continue
            persons = pm.person_masks(seg, img)
            w, h = img.size
            box_max = max(((float(b[2] - b[0]) * float(b[3] - b[1])) / (w * h) for _, b, _ in persons), default=0.0)
            out, share = pm.mask_photo(img, persons) if persons else (img, 0.0)
            row.update(persons=len(persons), masked_share=round(share, 4), person_box_max_share=round(box_max, 4))
            reason = ""
            if box_max > pm.MAX_BOX:
                reason = "person box over 25 percent of the picture"
            elif share > pm.MAX_MASKED:
                reason = "more than 15 percent masked"
            else:
                grown = grown_mask(persons, w, h) if persons else torch.zeros((h, w), dtype=torch.bool)
                left = uncovered(det, img, grown) + uncovered(det, out, grown)
                if left:
                    row["unmasked_found"] = left
                    reason = "second detector found a person the mask does not cover"
            row.update(keep=not reason, reason=reason, had_person=bool(persons))
            if not reason and persons:
                out.save(f"{pm.OUT}/{slug}/{pid}.jpg", quality=85)
            rows.append(row)
            if i % 10 == 0:
                print(slug, i, "of", len(cands), round(time.time() - t0), "s", flush=True)
        kept = [r for r in rows if r["keep"]]
        reasons = {}
        for r in rows:
            if not r["keep"]:
                reasons[r["reason"]] = reasons.get(r["reason"], 0) + 1
        stats = {"place": slug, "lane_steps_10m": steps, "candidates_checked": len(rows), "kept": len(kept),
                 "kept_untouched_no_person": sum(1 for r in kept if not r["had_person"]), "kept_masked": sum(1 for r in kept if r["had_person"]),
                 "rejected_by_reason": reasons,
                 "rules": "reject if masked share > 0.15, or a person box > 0.25 of the picture, or Faster R-CNN (score >= 0.5, on original and on masked picture) finds a person with < 0.6 of its box inside the grown mask",
                 "allow_list": [{k: r[k] for k in ("id", "creator", "lat", "lon", "persons", "masked_share")} for r in kept]}
        json.dump({**stats, "rows": rows}, open(f"{OUTD}/{slug}-safe.json", "w"), indent=2)
        open(f"{OUTD}/{slug}-safe.json", "a").write("\n")
        summary.append({k: v for k, v in stats.items() if k not in ("allow_list", "rules")})
        print(json.dumps(summary[-1]), flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cap = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 120
    if "--max" in sys.argv:
        args.remove(str(cap))
    main(args, cap)
