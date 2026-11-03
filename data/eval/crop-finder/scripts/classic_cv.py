"""Classic CPU-only box proposal (CC-133): long near-horizontal edge lines in the upper half of photo 2, grouped into boxes.

usage: uv run --no-project --with opencv-python-headless --with numpy --with pillow python -I classic_cv.py PHOTO_JPG OUT_JSON [OUT_JPG]
Steps: grey -> Canny -> probabilistic Hough (long, within 12 degrees of horizontal) -> boxes of the dilated line mask (connected parts)."""
import json, sys, time
import cv2, numpy as np
t0 = time.time()
img = cv2.imread(sys.argv[1]); h, w = img.shape[:2]
g = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (3, 3), 0)
e = cv2.Canny(g, 40, 120)
lines = cv2.HoughLinesP(e, 1, np.pi / 360, threshold=60, minLineLength=70, maxLineGap=8)
keep = []
for l in (lines if lines is not None else []):
    x0, y0, x1, y1 = [int(v) for v in np.ravel(l)]
    ang = abs(np.degrees(np.arctan2(y1 - y0, x1 - x0)))
    ang = min(ang, 180 - ang)
    if ang <= 12 and max(y0, y1) < 0.62 * h:
        keep.append((x0, y0, x1, y1))
m = np.zeros((h, w), np.uint8)
for x0, y0, x1, y1 in keep:
    cv2.line(m, (x0, y0), (x1, y1), 255, 3)
m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_RECT, (41, 25)))
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
boxes = []
for i in range(1, n):
    x, y, bw, bh, a = st[i]
    if bw >= 120:
        nl = sum(1 for (a0, b0, a1, b1) in keep if x <= (a0 + a1) / 2 < x + bw and y <= (b0 + b1) / 2 < y + bh)
        boxes.append({"label": "classic-lines", "score": round(min(1.0, nl / 30), 2), "box": [int(x), int(y), int(x + bw), int(y + bh)], "lines": nl})
out = {"items": boxes, "n_lines": len(keep), "seconds": round(time.time() - t0, 3)}
json.dump(out, open(sys.argv[2], "w"), indent=2)
if len(sys.argv) > 3:
    v = img.copy()
    for x0, y0, x1, y1 in keep:
        cv2.line(v, (x0, y0), (x1, y1), (0, 255, 255), 1)
    for b in boxes:
        cv2.rectangle(v, tuple(b["box"][:2]), tuple(b["box"][2:]), (0, 0, 255), 2)
    cv2.imwrite(sys.argv[3], v)
print(len(keep), "lines", len(boxes), "boxes", out["seconds"], "s")
for b in boxes: print(b)
