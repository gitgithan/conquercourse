"""CC-90: an independent second look at the photos kept after masking. A different detector (torchvision Faster R-CNN, score >= 0.5) runs over each usable photo as it would be shown (the masked copy, or the untouched photo when no person was found); any person it still finds is a miss of the masking step. usage: photos_mask_recheck.py SLUG.. (repo root)"""
import json, os, sys
import torch, torchvision
from PIL import Image
torch.set_num_threads(int(os.environ.get("THREADS", 4)))
model = torchvision.models.detection.fasterrcnn_resnet50_fpn(weights=torchvision.models.detection.FasterRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
to_t = torchvision.transforms.functional.to_tensor
for slug in sys.argv[1:]:
    p = f"data/eval/cc-90-photos/masking/{slug}-mask.json"
    d = json.load(open(p))
    miss, checked = [], 0
    for r in d["rows"]:
        if not r.get("usable"):
            continue
        f = os.path.expanduser(f"~/photos-masked/{slug}/{r['id']}.jpg") if r.get("had_person") else os.path.expanduser(f"~/photos-cache/{r['id']}.jpg")
        if not os.path.exists(f):
            continue
        img = Image.open(f).convert("RGB")
        with torch.no_grad():
            o = model([to_t(img)])[0]
        w, h = img.size
        found = [(round(float(s), 2), round(float((b[2] - b[0]) * (b[3] - b[1])) / (w * h), 4)) for l, s, b in zip(o["labels"], o["scores"], o["boxes"]) if int(l) == 1 and float(s) >= 0.5]
        checked += 1
        r["recheck_persons_left"] = len(found)
        if found:
            miss.append({"id": r["id"], "found": found})
    d["recheck"] = {"detector": "torchvision fasterrcnn_resnet50_fpn COCO, person score >= 0.5, run on the picture as shown", "photos_checked": checked, "photos_with_a_person_left": len(miss), "details": miss}
    json.dump(d, open(p, "w"), indent=2); open(p, "a").write("\n")
    print(slug, checked, "checked,", len(miss), "with a person still found", flush=True)
