"""CC-90: the allow-list of street photos without a close-up or large person, per real place.

usage: photos_people.py SLUG [SLUG ...] [--limit 0.2] [--sweep 0.1,0.2,0.35] [--max 150] [--all]   (run from the repo root with /root/venv-det/bin/python; token in ~/.config/ninja/mapillary.env, never printed)
Owner decision (2026-11-01): Mapillary's own face and plate blur is the base standard; on top of it we reject photos with a close-up or large person.
--limit L is the size setting: a photo is rejected when any detected person's box is taller than L of the picture's height (0.2 = a person filling a fifth of the picture or more).
  Small, far figures pass. `--limit 0` is the old strict rule (any person at any size rejects). Default: LIMIT below.
--sweep a,b,c runs the same cover search at each limit (the detector runs once per photo, results are shared) and writes only the coverage table
  data/eval/cc-90-no-filter/sweep-<slug>.json; no allow-list is written.
For each place: take the lane line, walk it every 10 m and (default, "cover" mode) look for photos that face the step (not panoramas), nearest first,
testing them with the person detector (torchvision Faster R-CNN ResNet-50 FPN, COCO weights; code BSD-3-Clause, COCO labels CC BY 4.0)
until each step has two kept photos or TRIES photos were rejected there; a kept photo covers every step it faces within 60 m. `--all` is the older way: test the four nearest at each step.
Writes (with --limit or no flag):
  public/assets/photos-live/<slug>.json        the allow-list the game reads (ids, creator, position, camera direction; no picture bytes, no addresses)
  data/eval/cc-90-photos/live/<slug>-filter.json   counts and the reason for every rejection
  data/eval/cc-90-photos/live/<slug>-kept-sheet.jpg  up to eight kept photos at 256 px, to look at by eye (small; the pictures themselves are not stored)
The detector is the only thing that decides: a person it misses gets through, so the sheet is looked at by eye and the list is re-made when the detector or the places change.
"""
import io, json, math, os, sys, time, urllib.request

import torch
import torchvision
from PIL import Image

STEP, NEAR, FACE_DEG, MARGIN, PER_STEP = 10.0, 60.0, 60.0, 70.0, 4
TRIES, WANT = 12, 2  # cover mode: most photos tried per step, and the kept photos wanted per step
SEEN_SCORE = 0.4
LIMIT = 0.2  # default size setting: tallest allowed person box as a share of the picture height
MEAS = {}  # photo id -> (persons, tallest box share of height, largest box share of area); one detector run per photo
M_LAT = 111320.0
UA = {"User-Agent": "conquercourse-research/0.1 (educational game; contact via repo)"}
FIELDS = "id,captured_at,is_pano,compass_angle,computed_compass_angle,geometry,computed_geometry,thumb_1024_url,creator"
CACHE = os.path.expanduser("~/photos-cache")


def token():
    for l in open(os.path.expanduser("~/.config/ninja/mapillary.env")):
        if l.startswith("MAPILLARY_TOKEN="):
            return l.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("no token")


TOK = token()


def get(url, headers=None, raw=False, tries=3):
    err = None
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or UA), timeout=60) as r:
                return r.read() if raw else json.load(r)
        except Exception as e:
            err = e
            time.sleep(2 * (n + 1))
    raise RuntimeError(type(err).__name__)  # never echo the address (it may hold the token)


def to_ll(lat0, lon0, x, y):
    return lat0 - y / M_LAT, lon0 + x / (M_LAT * math.cos(math.radians(lat0)))


def to_xy(lat0, lon0, lat, lon):
    return (lon - lon0) * M_LAT * math.cos(math.radians(lat0)), -(lat - lat0) * M_LAT


def bearing(x0, y0, x1, y1):
    return math.degrees(math.atan2(x1 - x0, -(y1 - y0))) % 360


def angdiff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def mapillary(lat0, lon0, xmin, xmax, ymin, ymax, slug=None):
    pooled = os.path.join(os.environ.get("POOLS", ""), f"{slug}.json") if slug and os.environ.get("POOLS") else None
    if pooled and os.path.exists(pooled):  # a pool saved by scripts/photos_pool.py (a VM's own fetch has come back short, so the pool is fetched on the laptop)
        return json.load(open(pooled))
    out, todo = {}, [(xmin, xmax, ymin, ymax)]
    while todo:
        a, b, c, d = todo.pop()
        la1, lo1 = to_ll(lat0, lon0, a, d)
        la2, lo2 = to_ll(lat0, lon0, b, c)
        url = f"https://graph.mapillary.com/images?bbox={lo1:.6f},{la1:.6f},{lo2:.6f},{la2:.6f}&limit=2000&fields={FIELDS}"
        data = get(url, {"Authorization": "OAuth " + TOK, **UA})["data"]
        if len(data) >= 2000 and (b - a) > 40:
            mx, my = (a + b) / 2, (c + d) / 2
            todo += [(a, mx, c, my), (mx, b, c, my), (a, mx, my, d), (mx, b, my, d)]
        else:
            for im in data:
                out[im["id"]] = im
        time.sleep(0.2)
    return list(out.values())


def candidates(pl, cap, cover=False):
    lat0, lon0 = pl["lat"], pl["lon"]
    x0, y0, x1, y1 = pl["lane"]["line"]
    n = int(math.hypot(x1 - x0, y1 - y0) // STEP) + 1
    samples = [(x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1)) for i in range(n)]
    box = (min(x0, x1) - MARGIN, max(x0, x1) + MARGIN, min(y0, y1) - MARGIN, max(y0, y1) + MARGIN)
    photos = []
    for im in mapillary(lat0, lon0, *box, slug=pl.get('slug') or pl.get('place') or pl.get('name')):
        g = im.get("computed_geometry") or im.get("geometry")
        ang = im.get("computed_compass_angle", im.get("compass_angle"))
        if not g or ang is None or im.get("is_pano") or not im.get("thumb_1024_url"):
            continue
        x, y = to_xy(lat0, lon0, g["coordinates"][1], g["coordinates"][0])
        photos.append({"im": im, "x": x, "y": y, "ang": ang, "lat": g["coordinates"][1], "lon": g["coordinates"][0]})
    if cover:
        return photos, samples, len(photos)
    chosen = {}
    for sx, sy in samples:
        near = sorted((math.hypot(p["x"] - sx, p["y"] - sy), p["im"]["id"], p) for p in photos)
        got = 0
        for d, pid, p in near:
            if d > NEAR:
                break
            if angdiff(p["ang"], bearing(p["x"], p["y"], sx, sy)) <= FACE_DEG and pid not in chosen:
                chosen[pid] = p
                got += 1
                if got >= PER_STEP:
                    break
    out = list(chosen.values())
    return out[:cap], len(photos), len(chosen), n


def load_image(p):
    os.makedirs(CACHE, exist_ok=True)
    f = f"{CACHE}/{p['im']['id']}.jpg"
    if not os.path.exists(f):
        open(f, "wb").write(get(p["im"]["thumb_1024_url"], raw=True))
    return Image.open(f).convert("RGB")


def sees_person(model, to_t, p, limit=None):
    """(kept, row, image): the detector measures the tallest person box; a photo is kept when it is not taller than `limit` of the picture height (limit 0: no person at all)."""
    limit = LIMIT if limit is None else limit
    pid = p["im"]["id"]
    row = {"id": pid}
    try:
        img = load_image(p)
    except Exception:
        row.update(kept=False, reason="download failed")
        return False, row, None
    if pid not in MEAS:
        with torch.no_grad():
            r = model([to_t(img)])[0]
        w, h = img.size
        boxes = [(float(b[3] - b[1]) / h, float(b[2] - b[0]) * float(b[3] - b[1]) / (w * h)) for l, s, b in zip(r["labels"], r["scores"], r["boxes"]) if int(l) == 1 and float(s) >= SEEN_SCORE]
        MEAS[pid] = (len(boxes), max((t for t, _ in boxes), default=0.0), max((a for _, a in boxes), default=0.0))
    n, tall, area = MEAS[pid]
    row.update(persons=n, person_max_height_share=round(tall, 4), person_max_area_share=round(area, 4))
    if n and tall > limit:
        row.update(kept=False, reason=f"person taller than {limit:g} of the picture" if limit else "a person at any size")
    else:
        row.update(kept=True)
    return row["kept"], row, img


def faces(p, sx, sy):
    return math.hypot(p["x"] - sx, p["y"] - sy) <= NEAR and angdiff(p["ang"], bearing(p["x"], p["y"], sx, sy)) <= FACE_DEG


def cover_run(model, to_t, slug, pool, samples, cap, limit=None):
    """Per lane step, test facing photos nearest first until WANT kept photos cover it (or TRIES were rejected, or cap tests were used)."""
    tested, kept_p, rows, sheet = {}, [], [], []
    for n, (sx, sy) in enumerate(samples):
        have = sum(1 for k in kept_p if faces(k, sx, sy))
        near = sorted((math.hypot(p["x"] - sx, p["y"] - sy), p["im"]["id"], p) for p in pool if faces(p, sx, sy))
        misses = 0
        for d, pid, p in near:
            if have >= WANT or misses >= TRIES or len(tested) >= cap:
                break
            if pid in tested:
                continue
            ok, row, img = sees_person(model, to_t, p, limit)
            tested[pid] = ok
            rows.append(row)
            if ok:
                kept_p.append(p)
                have += 1
                if len(sheet) < 8:
                    sheet.append(img.copy())
            else:
                misses += 1
        print(slug, "step", n + 1, "of", len(samples), "tested", len(tested), "kept", len(kept_p), flush=True)
    return kept_p, rows, sheet


def main(slugs, cap, cover, limit=None, sweep=None):
    torch.set_num_threads(int(os.environ.get("THREADS", os.cpu_count() or 4)))
    model = torchvision.models.detection.fasterrcnn_resnet50_fpn(weights=torchvision.models.detection.FasterRCNN_ResNet50_FPN_Weights.DEFAULT).eval()
    to_t = torchvision.transforms.functional.to_tensor
    os.makedirs("data/eval/cc-90-photos/live", exist_ok=True)
    os.makedirs("public/assets/photos-live", exist_ok=True)
    for slug in slugs:
        pl = json.load(open(f"public/assets/places/{slug}.json"))
        if sweep:
            pool, samples, in_box = candidates(pl, cap, True)
            rows_out = []
            for L in sweep:
                kept_p, rows, _ = cover_run(model, to_t, slug, pool, samples, cap, L)
                cov = sum(1 for sx, sy in samples if any(faces(k, sx, sy) for k in kept_p)) / len(samples)
                rows_out.append({"limit": L, "kept": len(kept_p), "tested": len(rows), "share_of_lane": round(cov, 2)})
                print(slug, json.dumps(rows_out[-1]), flush=True)
            os.makedirs("data/eval/cc-90-no-filter", exist_ok=True)
            json.dump({"place": slug, "lane_steps_10m": len(samples), "photos_in_box": in_box, "limits": rows_out}, open(f"data/eval/cc-90-no-filter/sweep-{slug}.json", "w"), indent=2)
            open(f"data/eval/cc-90-no-filter/sweep-{slug}.json", "a").write("\n")
            continue
        if cover:
            pool, samples, in_box = candidates(pl, cap, True)
            steps, facing = len(samples), len({p["im"]["id"] for p in pool if any(faces(p, sx, sy) for sx, sy in samples)})
            kept_p, rows, sheet = cover_run(model, to_t, slug, pool, samples, cap, limit)
            kept = [{"id": p["im"]["id"], "creator": (p["im"].get("creator") or {}).get("username", ""), "capturedAt": p["im"].get("captured_at"), "lat": round(p["lat"], 6), "lon": round(p["lon"], 6), "compass": round(p["ang"], 1)} for p in kept_p]
            cands = rows
        else:
            cands, in_box, facing, steps = candidates(pl, cap)
            kept, rows, sheet = [], [], []
            for i, p in enumerate(cands):
                ok, row, img = sees_person(model, to_t, p, limit)
                rows.append(row)
                if ok:
                    im = p["im"]
                    kept.append({"id": im["id"], "creator": (im.get("creator") or {}).get("username", ""), "capturedAt": im.get("captured_at"), "lat": round(p["lat"], 6), "lon": round(p["lon"], 6), "compass": round(p["ang"], 1)})
                    if len(sheet) < 8:
                        sheet.append(img.copy())
                if i % 10 == 0:
                    print(slug, i, "of", len(cands), "kept", len(kept), flush=True)
        reasons = {}
        for r_ in rows:
            if not r_["kept"]:
                reasons[r_["reason"]] = reasons.get(r_["reason"], 0) + 1
        json.dump({
            "place": slug, "name": pl["name"], "generated": time.strftime("%Y-%m-%d", time.gmtime()),
            "source": "Mapillary contributors, CC BY-SA 4.0; faces and plates are blurred by Mapillary (not a guarantee); photos with a close-up or large person (Faster R-CNN) are left out",
            "photos": sorted(kept, key=lambda k: k["id"]),
        }, open(f"public/assets/photos-live/{slug}.json", "w"), indent=2)
        open(f"public/assets/photos-live/{slug}.json", "a").write("\n")
        stats = {"place": slug, "mode": "cover" if cover else "all", "lane_steps_10m": steps, "photos_in_box_not_pano_with_direction": in_box, "facing_candidates_found": facing, "candidates_checked": len(rows),
                 "kept": len(kept), "rejected": len(rows) - len(kept), "rejected_by_reason": reasons, "detector": "torchvision fasterrcnn_resnet50_fpn COCO, person score >= 0.4", "limit_height_share": LIMIT if limit is None else limit, "rows": rows}
        json.dump(stats, open(f"data/eval/cc-90-photos/live/{slug}-filter.json", "w"), indent=2)
        open(f"data/eval/cc-90-photos/live/{slug}-filter.json", "a").write("\n")
        if sheet:
            W = 256
            tiles = [im.resize((W, int(W * im.height / im.width))) for im in sheet]
            cols, rows_n = 4, (len(tiles) + 3) // 4
            th = max(t.height for t in tiles)
            canvas = Image.new("RGB", (cols * W, rows_n * th), "white")
            for k, t in enumerate(tiles):
                canvas.paste(t, ((k % cols) * W, (k // cols) * th))
            canvas.save(f"data/eval/cc-90-photos/live/{slug}-kept-sheet.jpg", quality=70)
        print(slug, json.dumps({k: v for k, v in stats.items() if k != "rows"}), flush=True)


if __name__ == "__main__":
    argv = sys.argv[1:]
    def opt(name):
        if name in argv:
            i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
        return None
    cap = int(opt("--max") or 150)
    lim = opt("--limit"); sw = opt("--sweep")
    all_ = "--all" in argv
    args = [a for a in argv if not a.startswith("--")]
    main(args, cap, not all_, float(lim) if lim is not None else None, [float(x) for x in sw.split(",")] if sw else None)
