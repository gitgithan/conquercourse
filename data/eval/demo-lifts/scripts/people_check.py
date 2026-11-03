"""Same rule as scripts/photos_people.py (Faster R-CNN ResNet-50 FPN, COCO person score >= 0.4, tallest box share of picture height vs limit 0.2) for one or more local photos.
usage: uv run --no-project --with torch --with torchvision --with pillow python -I people_check.py OUT.json PHOTO [PHOTO ...]"""
import json, sys
import torch, torchvision
from PIL import Image
LIMIT, SEEN = 0.2, 0.4
out, photos = sys.argv[1], sys.argv[2:]
model = torchvision.models.detection.fasterrcnn_resnet50_fpn(weights=torchvision.models.detection.FasterRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
to_t = torchvision.transforms.functional.to_tensor
rows = []
for p in photos:
    img = Image.open(p).convert("RGB"); w, h = img.size
    with torch.no_grad():
        r = model([to_t(img)])[0]
    boxes = [(float(b[3] - b[1]) / h, [round(float(v)) for v in b], round(float(s), 3)) for l, s, b in zip(r["labels"], r["scores"], r["boxes"]) if int(l) == 1 and float(s) >= SEEN]
    tall = max((t for t, _, _ in boxes), default=0.0)
    rows.append({"photo": p.split("/")[-1], "persons": len(boxes), "person_max_height_share": round(tall, 4), "limit_height_share": LIMIT,
                 "kept": not (boxes and tall > LIMIT), "person_boxes": [{"box": b, "score": s, "height_share": round(t, 4)} for t, b, s in boxes]})
    print(rows[-1]["photo"], rows[-1]["persons"], rows[-1]["person_max_height_share"], rows[-1]["kept"])
json.dump({"rule": "scripts/photos_people.py", "rows": rows}, open(out, "w"), indent=2)
