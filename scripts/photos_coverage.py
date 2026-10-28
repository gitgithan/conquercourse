"""CC-90: how many nearby photos can a runner see along a real-place lane?

usage: photos_coverage.py OUT_DIR SLUG [SLUG ...]   (run from the repo root; token in ~/.config/ninja/mapillary.env, never printed)
For each place: take the lane line (metres east/south of the pin, see src/world/osm.ts), walk it every 10 m,
count Mapillary and Wikimedia Commons photos within 60 m, and how many face the lane.
"""
import json, math, os, statistics, sys, time, urllib.parse, urllib.request

STEP, NEAR, FACE_DEG, MARGIN = 10.0, 60.0, 60.0, 70.0
UA = {"User-Agent": "conquercourse-research/0.1 (educational game; contact via repo)"}
M_LAT = 111320.0


def token():
    for l in open(os.path.expanduser("~/.config/ninja/mapillary.env")):
        if l.startswith("MAPILLARY_TOKEN="):
            return l.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit("no token")


TOK = token()


def get(url, headers=None, tries=3):
    err = None
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            err = e
            time.sleep(2 * (n + 1))
    raise RuntimeError(type(err).__name__)  # never echo the URL (it may hold the token)


def to_ll(lat0, lon0, x, y):  # x east, y south (src/world/osm.ts)
    return lat0 - y / M_LAT, lon0 + x / (M_LAT * math.cos(math.radians(lat0)))


def to_xy(lat0, lon0, lat, lon):
    return (lon - lon0) * M_LAT * math.cos(math.radians(lat0)), -(lat - lat0) * M_LAT


def bearing(x0, y0, x1, y1):  # compass degrees (0 north, 90 east) from point 0 to point 1; y is south
    return (math.degrees(math.atan2(x1 - x0, -(y1 - y0)))) % 360


def angdiff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


MLY_FIELDS = "id,captured_at,is_pano,compass_angle,computed_compass_angle,geometry,computed_geometry,thumb_1024_url,creator"


def mapillary(lat0, lon0, xmin, xmax, ymin, ymax):
    """All images in the lane's bounding box, split in four while a box hits the 2000 limit."""
    out, todo = {}, [(xmin, xmax, ymin, ymax)]
    while todo:
        a, b, c, d = todo.pop()
        la1, lo1 = to_ll(lat0, lon0, a, d)  # south-west (y south is larger)
        la2, lo2 = to_ll(lat0, lon0, b, c)
        url = f"https://graph.mapillary.com/images?bbox={lo1:.6f},{la1:.6f},{lo2:.6f},{la2:.6f}&limit=2000&fields={MLY_FIELDS}"
        data = get(url, {"Authorization": "OAuth " + TOK, **UA})["data"]
        if len(data) >= 2000 and (b - a) > 40:
            mx, my = (a + b) / 2, (c + d) / 2
            todo += [(a, mx, c, my), (mx, b, c, my), (a, mx, my, d), (mx, b, my, d)]
        else:
            for im in data:
                out[im["id"]] = im
        time.sleep(0.2)
    return list(out.values())


def commons(lat0, lon0, samples):
    """Files within NEAR of the lane: one 60 m query every ~40 m of lane (a query returns at most 500), merged by page id."""
    seen = {}
    for sx, sy in samples[::4] + [samples[-1]]:
        lat, lon = to_ll(lat0, lon0, sx, sy)
        q = urllib.parse.urlencode({"action": "query", "list": "geosearch", "gscoord": f"{lat}|{lon}", "gsradius": int(NEAR),
                                    "gslimit": 500, "gsnamespace": 6, "format": "json"})
        for attempt in range(8):
            d = get("https://commons.wikimedia.org/w/api.php?" + q)
            if "query" in d:
                break
            time.sleep(8 * (attempt + 1))
        else:
            raise RuntimeError("commons: " + json.dumps(d)[:120])
        for c in d["query"]["geosearch"]:
            seen[c["pageid"]] = c
        time.sleep(1.0)
    return list(seen.values())


def analyse(photos, samples):
    """photos: dicts with x, y, facing_deg (None when unknown), pano. samples: lane points (x, y)."""
    near_ids, per_sample_near, per_sample_face, nearest = set(), [], [], []
    for sx, sy in samples:
        n = f = 0
        best = None
        for i, p in enumerate(photos):
            d = math.hypot(p["x"] - sx, p["y"] - sy)
            if d > NEAR:
                continue
            n += 1
            near_ids.add(i)
            best = d if best is None or d < best else best
            if p["pano"] or (p["facing_deg"] is not None and angdiff(p["facing_deg"], bearing(p["x"], p["y"], sx, sy)) <= FACE_DEG):
                f += 1
        per_sample_near.append(n)
        per_sample_face.append(f)
        if best is not None:
            nearest.append(best)
    length = STEP * (len(samples) - 1)
    return {
        "photos_within_60m_of_lane": len(near_ids),
        "per_100m_of_lane": round(100 * len(near_ids) / max(length, 1), 1),
        "share_of_lane_with_any_photo": round(sum(1 for n in per_sample_near if n) / len(samples), 2),
        "share_of_lane_with_facing_photo": round(sum(1 for n in per_sample_face if n) / len(samples), 2),
        "median_distance_m": round(statistics.median(nearest), 1) if nearest else None,
    }


def main(out, slugs):
    os.makedirs(out, exist_ok=True)
    run = {"step_m": STEP, "near_m": NEAR, "facing_within_deg": FACE_DEG, "places": {}}
    for slug in slugs:
        pl = json.load(open(f"public/assets/places/{slug}.json"))
        lat0, lon0 = pl["lat"], pl["lon"]
        x0, y0, x1, y1 = pl["lane"]["line"]
        length = math.hypot(x1 - x0, y1 - y0)
        n = int(length // STEP) + 1
        samples = [(x0 + (x1 - x0) * i / (n - 1), y0 + (y1 - y0) * i / (n - 1)) for i in range(n)]
        box = (min(x0, x1) - MARGIN, max(x0, x1) + MARGIN, min(y0, y1) - MARGIN, max(y0, y1) + MARGIN)
        mly_raw = mapillary(lat0, lon0, *box)
        mly = []
        for im in mly_raw:
            g = im.get("computed_geometry") or im.get("geometry")
            if not g:
                continue
            x, y = to_xy(lat0, lon0, g["coordinates"][1], g["coordinates"][0])
            ang = im.get("computed_compass_angle", im.get("compass_angle"))
            mly.append({"id": im["id"], "x": x, "y": y, "facing_deg": ang, "pano": bool(im.get("is_pano")),
                        "year": time.gmtime(im["captured_at"] / 1000).tm_year if im.get("captured_at") else None,
                        "thumb": im.get("thumb_1024_url"), "user": (im.get("creator") or {}).get("username")})
        com_raw = commons(lat0, lon0, samples)
        com = []
        for c in com_raw:
            x, y = to_xy(lat0, lon0, c["lat"], c["lon"])
            com.append({"title": c["title"], "x": x, "y": y, "facing_deg": None, "pano": False})
        res = {
            "lane": {"line_m": [x0, y0, x1, y1], "length_m": round(length, 1), "samples": n, "lat": lat0, "lon": lon0},
            "mapillary": {"images_in_box": len(mly), **analyse(mly, samples)},
            "commons": {"files_near_lane": len(com), **analyse(com, samples),
                        "note": "Commons files carry no viewing direction in geosearch, so facing is not measured"},
        }
        near = [p for p in mly if min(math.hypot(p["x"] - sx, p["y"] - sy) for sx, sy in samples) <= NEAR]
        years = {}
        for p in near:
            years[str(p["year"])] = years.get(str(p["year"]), 0) + 1
        res["mapillary"]["capture_years_of_near_photos"] = dict(sorted(years.items()))
        res["mapillary"]["pano_share_of_near_photos"] = round(sum(1 for p in near if p["pano"]) / max(len(near), 1), 2)
        res["mapillary"]["distinct_creators_near"] = len({p["user"] for p in near})
        run["places"][slug] = res
        # the twelve nearest facing photos (for the contact sheet, fetched in a second step)
        def dist(p):
            return min(math.hypot(p["x"] - sx, p["y"] - sy) for sx, sy in samples)
        facing = [p for p in near if p["pano"] or (p["facing_deg"] is not None and any(
            math.hypot(p["x"] - sx, p["y"] - sy) <= NEAR and angdiff(p["facing_deg"], bearing(p["x"], p["y"], sx, sy)) <= FACE_DEG for sx, sy in samples))]
        pick = sorted(facing, key=dist)
        # spread the sample along the lane: every k-th, so the sheet is not twelve pictures of one corner
        step = max(1, len(pick) // 12)
        sheet = [{k: p[k] for k in ("id", "thumb", "user", "year", "pano")} for p in pick[::step][:12]]
        json.dump(sheet, open(f"{out}/{slug}-sheet-picks.json", "w"), indent=2)
        json.dump([{k: p[k] for k in ("id", "x", "y", "facing_deg", "pano", "year")} for p in mly], open(f"{out}/{slug}-mapillary-points.json", "w"), separators=(",", ":"))  # no thumbnail links (they expire), no user names
        json.dump([{k: c[k] for k in ("pageid", "title", "lat", "lon")} for c in com_raw], open(f"{out}/{slug}-commons-points.json", "w"), separators=(",", ":"))
        print(slug, json.dumps(res["mapillary"]), json.dumps(res["commons"]))
    run["captured"] = time.strftime("%Y-%m-%d", time.gmtime())
    json.dump(run, open(f"{out}/run.json", "w"), indent=2)


main(sys.argv[1], sys.argv[2:])
