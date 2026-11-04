#!/usr/bin/env python3
"""Lab 21 (what the model cannot do): builds the small card pictures and the data file from files already in the repo.

Run from the repo root: python3 scripts/lab-limits-build.py
Reads data/eval (lift checks and ratings of the 14 hard photos, the finder run on the monkey-bars photo, the Kimodo bar-hang samples)
and writes public/assets/labs/limits/card-*.webp (360 x 240) and src/labs/limits/limits-data.json (2-space JSON).
Nothing here calls a model or spends anything.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

E = "data/eval"
OUT = "public/assets/labs/limits"
os.makedirs(OUT, exist_ok=True)
W, H = 360, 240
BG = (238, 243, 238)


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def card(name, img, crop=None, cover=True):
    """Fit a picture into the 360 x 240 card: cover (crop the middle) or contain (letterbox)."""
    img = img.convert("RGB")
    if crop:
        img = img.crop(crop)
    w, h = img.size
    s = max(W / w, H / h) if cover else min(W / w, H / h)
    img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    c = Image.new("RGB", (W, H), BG)
    c.paste(img, ((W - img.size[0]) // 2, (H - img.size[1]) // 2))
    c.save(f"{OUT}/{name}.webp", "WEBP", quality=62, method=6)


def tint(photo, mask, rgb=(217, 116, 26), a=0.55):
    p = Image.open(photo).convert("RGB")
    m = Image.open(mask).convert("L").resize(p.size).point(lambda v: 255 if v > 127 else 0)
    over = Image.new("RGB", p.size, rgb)
    return Image.composite(Image.blend(p, over, a), p, m)


# 1 the finder on the monkey-bars photo: the outlines it gave back
card("card-finder-bars", Image.open(f"{E}/demo-lifts/evidence/photo2_segment_objects.jpg"))
# 2 steps lifted as two slabs (mask the model made, orange)
card("card-stairs", tint(f"{E}/cc-upload-hard-set/inputs/skate-stairs.jpg", f"{E}/cc-upload-hard-set/r1/skate-stairs/mask.png"))
# 3 a rack under a pile of bikes
card("card-tangle", tint(f"{E}/cc-upload-hard-set/inputs/bike-rack-tangle.jpg", f"{E}/cc-upload-hard-set/r1/bike-rack-tangle/mask.png"))
# 4 the saved box that was a thin shadow strip (red box on the park photo)
im = Image.open("public/assets/park/park06.jpg").convert("RGB")
box = [x for x in json.load(open(f"{E}/cc-38-photo-to-3d/photos.json")) if x["photo"] == "park06"][0]["box"]
ImageDraw.Draw(im).rectangle(box, outline=(200, 30, 30), width=5)
card("card-strip", im)
# 5 a painted wall lifted as a table (front and side views, round 2)
sheet = Image.open(f"{E}/cc-38-photo-to-3d/r2/mural02/sheet.png").convert("RGB")
card("card-wall-table", sheet, crop=(0, 60, 1130, 345), cover=False)
# 6 the monkey bars: the real bars above, the lift seen from the side below (a flat plank)
c = Image.new("RGB", (W, H), (255, 255, 255))
g = ImageDraw.Draw(c)
real = Image.open(f"{E}/demo-lifts/evidence/maskbox_p2_monkey_bars.jpg").convert("RGB").crop((540, 270, 1240, 360)).resize((340, 44), Image.LANCZOS)
c.paste(real, (10, 22))
g.text((10, 6), "the real bars", font=font(11), fill=(23, 32, 29))
lift = Image.open(f"{E}/demo-lifts/evidence/lifts_turntables.jpg").convert("RGB").crop((20, 815, 280, 842))
lift = lift.resize((340, round(27 * 340 / 260)), Image.LANCZOS)
g.text((10, 90), "what the lift gave, from the side", font=font(11), fill=(23, 32, 29))
c.paste(lift, (10, 108))
g.text((10, 170), "A flat dark plank: the loops are gone.", font=font(12), fill=(23, 32, 29))
c.save(f"{OUT}/card-bars-flat.webp", "WEBP", quality=70, method=6)
# 7 the fitted row of rungs the game uses instead of the mesh (our collision Lab picture: rung peaks seen side-on)
card("card-bars-row", Image.open("docs/evidence/cc-133-pipeline-labs/lab-collision.png"), crop=(390, 296, 910, 372), cover=False)
# 8 Kimodo: grip error of the 8 travel samples, gate pass or not
d = json.load(open(f"{E}/bar-motion/outputs/r1-travel.json"))
c = Image.new("RGB", (W, H), (255, 255, 255))
g = ImageDraw.Draw(c)
g.text((10, 8), "Kimodo hangs: metres off the rung", font=font(11), fill=(23, 32, 29))
x0, y0, bw = 28, 205, 30
rows = []
for i, s in enumerate(d["samples"]):
    ge = s["sample"]["grip_error_m"]["mean"]
    ok = s["sample"]["gate_pass"]
    rows.append({"seed": s["seed"], "gate_pass": ok, "bar_ok": s["sample"]["bar_check_ok"], "grip_error_m": ge})
    x = x0 + i * (bw + 8)
    h = ge * 90
    g.rectangle([x, y0 - h, x + bw, y0], fill=(15, 107, 92) if ok else (150, 160, 155))
    g.text((x + 2, y0 - h - 13), f"{ge:.2f}", font=font(10), fill=(23, 32, 29))
g.line([x0 - 6, y0, W - 10, y0], fill=(23, 32, 29))
g.line([x0 - 6, y0 - 0.05 * 90, W - 10, y0 - 0.05 * 90], fill=(185, 28, 28), width=1)
g.text((10, 218), "teal = passed the clip gate; all 8 failed the bar check", font=font(10), fill=(82, 96, 90))
c.save(f"{OUT}/card-hang-samples.webp", "WEBP", quality=70, method=6)
# 9 a split-rail fence lifted as a heap of rails (mask the model made)
card("card-fence", tint(f"{E}/cc-110-real-objects/inputs/fence-split-rail.jpg", f"{E}/cc-110-real-objects/r2/fence-split-rail/mask.png"))
# 10 a photo the triage model called poor, that lifted well
card("card-triage", Image.open(f"{E}/cc-110-real-objects/inputs/barrel-oak.jpg"))
# 11 a valid one-pixel picture, enlarged
c = Image.new("RGB", (W, H), BG)
g = ImageDraw.Draw(c)
g.rectangle([110, 20, 250, 160], fill=(255, 255, 255), outline=(23, 32, 29), width=2)
g.text((W // 2, 190), "1 x 1 pixel, white (enlarged)", font=font(13), fill=(23, 32, 29), anchor="mm")
c.save(f"{OUT}/card-pixel.webp", "WEBP", quality=70, method=6)

# the lift check on the 14 hard photos: the game's own numbers (pipelines/ccpipe/padretry.py), and the human rating by eye
scores = json.load(open(f"{E}/cc-upload-hard-set/scores.json"))
gate = []
for p, v in scores.items():
    pr = json.load(open(f"{E}/cc-upload-hard-set/r1/{p}/entry.json"))["padretry"]
    gate.append({"photo": p, "rating": v["score"], "note": v["note"], "extent_aspect": pr["extent_aspect"], "mask_aspect": pr["mask_aspect"],
                 "ratio": round(pr["extent_aspect"] / pr["mask_aspect"], 3), "game_says_bad": pr["bad"]})
# the finder on the monkey-bars photo: 12 outlines, scores, and whether any covers a bar pattern the player wants
sug = json.load(open(f"{E}/demo-lifts/suggest/photo2/suggest.json"))["items"]
ov = json.load(open(f"{E}/demo-lifts/finder_vs_red_boxes.json"))
finder = [{"label": s["label"], "score": s["score"], "box": s["box"]} for s in sug]
data = {
    "about": "Built by scripts/lab-limits-build.py from data/eval/cc-upload-hard-set, data/eval/demo-lifts and data/eval/bar-motion. Nothing here is made up.",
    "gate": gate,
    "finder": {"outlines": finder, "best_iou_with_bar_patterns": {"loops_top": ov["red"]["loops_top"]["best_iou"], "left_grid": ov["red"]["left_grid"]["best_iou"]}},
    "hang_samples": {"gate_pass": 3, "bar_check_ok": 0, "of": 8, "rows": rows},
}
os.makedirs("src/labs/limits", exist_ok=True)
with open("src/labs/limits/limits-data.json", "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("ok", sum(os.path.getsize(f"{OUT}/{n}") for n in os.listdir(OUT)), "bytes of pictures")
