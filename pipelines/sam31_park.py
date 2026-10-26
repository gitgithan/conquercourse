"""SAM 3.1 spike (CC-24): 10 park photos x 5 noun phrases through the local proxy.

usage: sam31_park.py EXPERIMENT_DIR [PROXY_URL]
Needs the proxy running (server/sam-proxy.mjs) and meta_sam_parser, pillow, numpy on the path.
Writes outputs/raw/*.json, outputs/overlays/*.jpg, outputs/results.json, run.json.
"""
import base64, concurrent.futures as cf, glob, json, os, re, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from meta_sam_parser import SegmentationMask, decode_mask_to_raster

PHRASES = ["bench", "wall", "rail", "ledge", "steps", "stairs", "handrail", "platform", "concrete block", "low wall"]
COLORS = {"bench": (230, 60, 60), "wall": (60, 120, 230), "rail": (250, 200, 30), "ledge": (60, 200, 90), "steps": (190, 80, 220),
          "stairs": (240, 140, 200), "handrail": (255, 140, 0), "platform": (0, 200, 200), "concrete block": (150, 110, 60), "low wall": (120, 200, 255)}
PRICE_PER_IMAGE = 2.50 / 1000
LINE = re.compile(r"(?:<\d+f>|,)(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([\d.]+))?\|>"
                  r"(?:<\|mask;x=(\d+);y=(\d+)(?:;c=[\d.]+)?;data=(\d+),(\d+),(.)(.*?)\|>)?", re.S)


def call(proxy, path, phrase, exp):
    cache = f"{exp}/outputs/raw/{os.path.basename(path)[:-4]}-{phrase}.json"
    if os.path.exists(cache):  # reparse without paying again
        meta = json.load(open(cache))
        return {"status": 200, "ms": meta["_ms"], "raw": json.dumps(meta)}, meta["_seconds"]
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    body = json.dumps({"image": "data:image/jpeg;base64," + b64, "phrase": phrase}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            req = urllib.request.Request(proxy + "/segment", body, {"content-type": "application/json"})
            out = json.load(urllib.request.urlopen(req, timeout=180))
            if out["status"] == 200:
                secs = time.time() - t0
                meta = json.loads(out["raw"]); meta["_ms"], meta["_seconds"] = out["ms"], secs
                json.dump(meta, open(cache, "w"))
                return {**out, "raw": json.dumps(meta)}, secs
        except Exception as e:
            out = {"status": 0, "ms": 0, "raw": str(e)}
        time.sleep(2 + 3 * attempt)
    return out, time.time() - t0


def parse(text, size):
    objs = []
    for m in LINE.finditer(text):
        oid, x1, y1, x2, y2, _, _, c, mx, my, mh, mw, enc, payload = m.groups()
        o = {"id": int(oid), "box": [int(x1), int(y1), int(x2), int(y2)], "score": float(c) if c else None, "mask": None}
        if payload is not None:
            mh, mw = int(mh), int(mw)
            raster = decode_mask_to_raster(SegmentationMask("lossless" if enc == "~" else "one_bit", enc + payload, mw, mh))
            arr = np.frombuffer(raster, np.uint8).reshape(mh, mw)
            ox, oy = int(x1) + int(mx), int(y1) + int(my)
            o["mask"] = (arr, ox, oy)
            o["mask_px"] = int(arr.sum())
            o["mask_fills_box"] = round(float(arr.mean()), 3)
        objs.append(o)
    return objs


def main(exp, proxy):
    photos = sorted(glob.glob(f"{exp}/inputs/park*.jpg"))
    for d in ("raw", "overlays"):
        os.makedirs(f"{exp}/outputs/{d}", exist_ok=True)
    jobs = [(p, ph) for p in photos for ph in PHRASES]
    t0 = time.time()
    with cf.ThreadPoolExecutor(4) as ex:
        res = list(ex.map(lambda j: call(proxy, *j, exp), jobs))
    wall = time.time() - t0
    results, per_photo = [], {}
    for (p, ph), (out, secs) in zip(jobs, res):
        name = os.path.basename(p)[:-4]
        raw = json.loads(out["raw"]) if out["status"] == 200 else {"error": out["raw"]}
        text = raw["output"][0]["content"][0]["text"] if out["status"] == 200 else ""
        size = Image.open(p).size
        objs = parse(text, size) if text else []
        per_photo.setdefault(name, {})[ph] = objs
        results.append({"photo": name, "phrase": ph, "http": out["status"], "seconds": round(secs, 2), "api_ms": out["ms"],
                        "images_processed": raw.get("usage", {}).get("images_processed"),
                        "count": len(objs), "scores": [o["score"] for o in objs],
                        "boxes": [o["box"] for o in objs], "mask_px": [o.get("mask_px") for o in objs]})
    for name, byphrase in per_photo.items():
        img = Image.open(f"{exp}/inputs/{name}.jpg").convert("RGB")
        canvas = np.array(img, np.float32)
        for ph, objs in byphrase.items():
            for o in objs:
                if o["mask"] is None:
                    continue
                arr, ox, oy = o["mask"]
                h, w = arr.shape
                reg = canvas[oy:oy + h, ox:ox + w]
                arr = arr[:reg.shape[0], :reg.shape[1]].astype(bool)
                reg[arr] = reg[arr] * 0.45 + np.array(COLORS[ph], np.float32) * 0.55
        out = Image.fromarray(canvas.astype(np.uint8))
        dr = ImageDraw.Draw(out)
        for i, ph in enumerate(PHRASES):
            dr.rectangle([6, 6 + 18 * i, 20, 20 + 18 * i], fill=COLORS[ph])
            dr.text((26, 7 + 18 * i), f"{ph}: {len(byphrase[ph])}", fill=(255, 255, 255))
        out.save(f"{exp}/outputs/overlays/{name}.jpg", quality=85)
    ok = [r for r in results if r["http"] == 200]
    n_img = sum(r["images_processed"] or 0 for r in ok)
    secs = sorted(r["seconds"] for r in ok)
    run = {"experiment": "sam31-park", "issue": "CC-24", "date": time.strftime("%Y-%m-%d"), "model": "sam-3.1",
           "endpoint": "POST /v1/responses via local proxy", "photos": len(photos), "phrases": PHRASES,
           "requests": len(jobs), "http_ok": len(ok), "images_processed": n_img,
           "cost_usd": round(n_img * PRICE_PER_IMAGE, 4), "price_basis": "$2.50 per 1,000 images (docs/research/meta-rules-api.md)",
           "seconds_median": secs[len(secs) // 2] if secs else None, "seconds_p90": secs[int(len(secs) * 0.9) - 1] if secs else None,
           "seconds_max": secs[-1] if secs else None, "wall_seconds_for_all": round(wall, 1), "client_concurrency": 4,
           "gpu_minutes_modal": 0}
    json.dump(run, open(f"{exp}/run.json", "w"), indent=1)
    json.dump(results, open(f"{exp}/outputs/results.json", "w"), indent=1)
    print(json.dumps(run, indent=1))


main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8787")
