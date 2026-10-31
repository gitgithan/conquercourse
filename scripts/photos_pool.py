"""CC-90: save the Mapillary photo records (ids, positions, directions, creator, picture address) around each place's lane to one JSON file per place.

usage: photos_pool.py OUTDIR SLUG [SLUG ...]   (run from the repo root; token parsed from ~/.config/ninja/mapillary.env, never printed)
Why: a VM's own fetch came back with a third of the photos missing; fetched on the laptop it is complete. Then run photos_people.py with POOLS=OUTDIR.
The picture addresses expire and hold no token; the files are working data and stay out of git.
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import photos_lane_audit as A

A.FIELDS = "id,captured_at,is_pano,compass_angle,computed_compass_angle,geometry,computed_geometry,thumb_1024_url,creator"
def tiled(lat0, lon0, xmin, xmax, ymin, ymax, side=50.0, cap=600):
    """Fetch in tiles of about `side` metres, splitting any tile that returns `cap` or more (a big box has come back short without saying so, so big boxes are never trusted)."""
    out, todo = {}, []
    nx, ny = max(1, math.ceil((xmax - xmin) / side)), max(1, math.ceil((ymax - ymin) / side))
    for i in range(nx):
        for j in range(ny):
            todo.append((xmin + (xmax - xmin) * i / nx, xmin + (xmax - xmin) * (i + 1) / nx, ymin + (ymax - ymin) * j / ny, ymin + (ymax - ymin) * (j + 1) / ny))
    while todo:
        a, b, c, d = todo.pop()
        la1, lo1 = A.to_ll(lat0, lon0, a, d)
        la2, lo2 = A.to_ll(lat0, lon0, b, c)
        data = A.get(f"https://graph.mapillary.com/images?bbox={lo1:.6f},{la1:.6f},{lo2:.6f},{la2:.6f}&limit=2000&fields={A.FIELDS}")["data"]
        if len(data) >= cap and (b - a) > 6:
            mx, my = (a + b) / 2, (c + d) / 2
            todo += [(a, mx, c, my), (mx, b, c, my), (a, mx, my, d), (mx, b, my, d)]
        else:
            for im in data:
                out[im["id"]] = im
    return list(out.values())


out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for s in sys.argv[2:]:
    pl = json.load(open(f"public/assets/places/{s}.json"))
    x0, y0, x1, y1 = pl["lane"]["line"]
    ims = tiled(pl["lat"], pl["lon"], min(x0, x1) - A.MARGIN, max(x0, x1) + A.MARGIN, min(y0, y1) - A.MARGIN, max(y0, y1) + A.MARGIN)
    json.dump(ims, open(f"{out}/{s}.json", "w"))
    print(s, len(ims), flush=True)
