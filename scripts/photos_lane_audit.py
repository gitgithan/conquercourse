"""CC-90: for each ready place, how well do Mapillary street photos cover its lane? (no pictures are downloaded, no person filter here)

usage: photos_lane_audit.py OUT.json [SLUG ...]   (no slugs = every place in public/assets/places/index.json; run from the repo root)
The token is read from ~/.config/ninja/mapillary.env by parsing the file (it holds a `|`, so never `source` it) and is never printed or saved.
Walks the lane line every 10 m (real metres east/south of the pin, src/world/osm.ts) and counts Mapillary photos (not panoramas, with a camera
direction) within 60 m of a step whose camera points within 60 degrees of that step. Same rules as scripts/photos_people.py and src/world/live-photos.ts.
Output per place: lane length, photos facing the lane, per 100 m, and the share of 10 m steps that have at least one facing photo.
"""
import json, math, os, sys, time, urllib.request

STEP, NEAR, FACE_DEG, MARGIN = 10.0, 60.0, 60.0, 70.0
M_LAT = 111320.0
UA = {"User-Agent": "conquercourse-research/0.1 (educational game; contact via repo)"}
FIELDS = "id,is_pano,compass_angle,computed_compass_angle,geometry,computed_geometry"


def token():
    for l in open(os.path.expanduser("~/.config/ninja/mapillary.env")):
        if l.startswith("MAPILLARY_TOKEN="):
            return l.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("no token")


TOK = token()


def get(url, tries=4):
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": "OAuth " + TOK, **UA}), timeout=60) as r:
                return json.load(r)
        except Exception:
            time.sleep(2 * (n + 1))
    raise RuntimeError("mapillary request failed")  # never echo the address


def to_ll(lat0, lon0, x, y):
    return lat0 - y / M_LAT, lon0 + x / (M_LAT * math.cos(math.radians(lat0)))


def to_xy(lat0, lon0, lat, lon):
    return (lon - lon0) * M_LAT * math.cos(math.radians(lat0)), -(lat - lat0) * M_LAT


def bearing(x0, y0, x1, y1):
    return math.degrees(math.atan2(x1 - x0, -(y1 - y0))) % 360


def angdiff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def fetch(lat0, lon0, xmin, xmax, ymin, ymax):
    out, todo = {}, [(xmin, xmax, ymin, ymax)]
    while todo:
        a, b, c, d = todo.pop()
        la1, lo1 = to_ll(lat0, lon0, a, d)
        la2, lo2 = to_ll(lat0, lon0, b, c)
        data = get(f"https://graph.mapillary.com/images?bbox={lo1:.6f},{la1:.6f},{lo2:.6f},{la2:.6f}&limit=2000&fields={FIELDS}")["data"]
        if len(data) >= 2000 and (b - a) > 40:
            mx, my = (a + b) / 2, (c + d) / 2
            todo += [(a, mx, c, my), (mx, b, c, my), (a, mx, my, d), (mx, b, my, d)]
        else:
            for im in data:
                out[im["id"]] = im
        time.sleep(0.2)
    return list(out.values())


def audit(pl):
    lat0, lon0 = pl["lat"], pl["lon"]
    x0, y0, x1, y1 = pl["lane"]["line"]
    length = math.hypot(x1 - x0, y1 - y0)
    n = int(length // STEP) + 1
    steps = [(x0 + (x1 - x0) * i / max(1, n - 1), y0 + (y1 - y0) * i / max(1, n - 1)) for i in range(n)]
    ims = fetch(lat0, lon0, min(x0, x1) - MARGIN, max(x0, x1) + MARGIN, min(y0, y1) - MARGIN, max(y0, y1) + MARGIN)
    photos = []
    for im in ims:
        g = im.get("computed_geometry") or im.get("geometry")
        ang = im.get("computed_compass_angle", im.get("compass_angle"))
        if not g or ang is None or im.get("is_pano"):
            continue
        x, y = to_xy(lat0, lon0, g["coordinates"][1], g["coordinates"][0])
        photos.append((x, y, ang))
    facing, covered = set(), 0
    for sx, sy in steps:
        hit = False
        for i, (x, y, ang) in enumerate(photos):
            if math.hypot(x - sx, y - sy) <= NEAR and angdiff(ang, bearing(x, y, sx, sy)) <= FACE_DEG:
                facing.add(i)
                hit = True
        covered += hit
    return {"laneRealM": round(length, 1), "steps10m": n, "photosInBox": len(ims), "photosUsable": len(photos), "facing": len(facing),
            "facingPer100m": round(100 * len(facing) / max(length, 1), 1), "shareOfLaneCovered": round(covered / n, 2)}


if __name__ == "__main__":
    out = sys.argv[1]
    index = json.load(open("public/assets/places/index.json"))
    slugs = sys.argv[2:] or [e["slug"] for e in index]
    rows = json.load(open(out)) if os.path.exists(out) else []
    done = {r["slug"] for r in rows}
    for s in slugs:
        if s in done:
            continue
        pl = json.load(open(f"public/assets/places/{s}.json"))
        try:
            r = audit(pl)
        except Exception as e:
            r = {"error": type(e).__name__}
        r.update(slug=s, name=pl["name"])
        rows.append(r)
        json.dump(rows, open(out, "w"), indent=2)
        print(json.dumps(r), flush=True)
