"""Lab 14: make the cut-out pictures from recorded inputs (no model run): photo on the left, the recorded mask's cut-out on the right.
Run: python3 scripts/lab-lift-pictures.py   (needs Pillow)"""
from PIL import Image
import shutil
BASE = "data/eval/cc-38-photo-to-3d"
for name in ["bench01", "rail01"]:
    photo = Image.open(f"{BASE}/inputs/{name}.jpg").convert("RGB")
    mask = Image.open(f"{BASE}/r3/{name}/mask.png").convert("L").resize(photo.size)
    grey = Image.new("RGB", photo.size, (225, 230, 226))
    cut = Image.composite(photo, grey, mask.point(lambda v: 255 if v > 127 else 0))
    w = 480
    h = round(photo.size[1] * w / photo.size[0])
    out = Image.new("RGB", (w * 2 + 8, h), (255, 255, 255))
    out.paste(photo.resize((w, h)), (0, 0))
    out.paste(cut.resize((w, h)), (w + 8, 0))
    out.save(f"public/assets/lab/lift/{name}-cutout.jpg", quality=80)
shutil.copy("docs/evidence/cc-133-lifts/monkey-bars-preview-then-lift-input.jpg", "public/assets/lab/lift/monkey-bars-cutout.jpg")
