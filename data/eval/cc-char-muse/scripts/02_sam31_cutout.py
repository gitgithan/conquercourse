"""Step 2: SAM 3.1 (Meta Model API, $2.50 per 1000 images) cuts the character out of the Muse Image picture.
usage: uv run --no-project --with pillow --with numpy --with meta_sam_parser python 02_sam31_cutout.py IMAGES_DIR MASKS_DIR"""
import base64, io, json, os, re, sys, time, urllib.request
import numpy as np
from PIL import Image
from meta_sam_parser import SegmentationMask, decode_mask_to_raster

LINE = re.compile(r"(?:<\d+f>|,)(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>"
                  r"(?:<\|mask;x=(\d+);y=(\d+)(?:;c=[\d.]+)?;data=(\d+),(\d+),(.)(.*?)\|>)?", re.S)


def env():
    d = {}
    for line in open(os.path.expanduser("~/.config/ninja/meta.env")):
        if "=" in line:
            k, v = line.strip().split("=", 1)
            d[k] = v.strip().strip('"')
    return d


def segment(e, png, phrase):
    jpg = io.BytesIO(); Image.open(io.BytesIO(png)).convert("RGB").save(jpg, "JPEG", quality=92)
    url = "data:image/jpeg;base64," + base64.b64encode(jpg.getvalue()).decode()
    body = json.dumps({"model": "sam-3.1", "input": [{"role": "user", "content": [{"type": "input_image", "image_url": url}, {"type": "input_text", "text": phrase}]}], "metadata": {"include_confidence": "true"}}).encode()
    req = urllib.request.Request(e["META_BASE_URL"].rstrip("/") + "/responses", body, {"content-type": "application/json", "authorization": "Bearer " + e["META_API_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=180))


def parse(text, w, h):
    best = None
    for m in LINE.finditer(text):
        oid, x1, y1, x2, y2, _, _, c, mx, my, mh, mw, enc, payload = m.groups()
        if payload is None:
            continue
        mh, mw = int(mh), int(mw)
        arr = np.frombuffer(decode_mask_to_raster(SegmentationMask("lossless" if enc == "~" else "one_bit", enc + payload, mw, mh)), np.uint8).reshape(mh, mw)
        # the mask raster covers the box at a lower resolution (1024 x 816 for a 1556 x 1240 box): scale it up to the box
        bw, bh = int(x2) - int(x1), int(y2) - int(y1)
        up = np.asarray(Image.fromarray((arr * 255).astype(np.uint8)).resize((bw, bh), Image.BILINEAR)) > 127
        full = np.zeros((h, w), bool)
        ox, oy = int(x1), int(y1)
        full[oy:oy + bh, ox:ox + bw] = up[: h - oy, : w - ox]
        o = {"mask": full, "score": float(c) if c else 0, "px": int(full.sum())}
        if best is None or o["px"] > best["px"]:
            best = o
    return best


if __name__ == "__main__":
    imgs, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    e = env(); runs = []
    for f in sorted(os.listdir(imgs)):
        if not f.endswith(".png"): continue
        cid = f[:-4]; png = open(f"{imgs}/{f}", "rb").read(); w, h = Image.open(io.BytesIO(png)).size
        t0 = time.time()
        try:
            r = segment(e, png, "character")
            text = r["output"][0]["content"][0]["text"]
            json.dump({k: v for k, v in r.items() if k != "output"}, open(f"{out}/{cid}.meta.json", "w")); open(f"{out}/{cid}.raw.txt", "w").write(text)
            b = parse(text, w, h)
            if b: Image.fromarray((b["mask"] * 255).astype(np.uint8)).save(f"{out}/{cid}.mask.png")
            runs.append({"id": cid, "ok": b is not None, "score": b and b["score"], "mask_px": b and b["px"], "frac": b and round(b["px"] / (w * h), 3), "seconds": round(time.time() - t0, 1)})
        except Exception as ex:
            runs.append({"id": cid, "ok": False, "error": str(ex)[:300], "seconds": round(time.time() - t0, 1)})
        print(runs[-1], flush=True)
    json.dump(runs, open(f"{out}/sam_runs.json", "w"), indent=2)
