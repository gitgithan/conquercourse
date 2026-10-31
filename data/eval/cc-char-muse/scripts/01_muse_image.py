"""Step 1: Muse Image text-to-image for the eight prompts (about $0.01 each). Key from ~/.config/ninja/meta.env, never printed.
usage: 01_muse_image.py OUT_DIR [only-id ...]"""
import base64, json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(f"{HERE}/../inputs/prompts.json"))


def env():
    d = {}
    for line in open(os.path.expanduser("~/.config/ninja/meta.env")):
        if "=" in line:
            k, v = line.strip().split("=", 1)
            d[k] = v.strip().strip('"')
    return d


def main(out, only):
    e = env()
    os.makedirs(out, exist_ok=True)
    runs = []
    for c in P["characters"]:
        if only and c["id"] not in only:
            continue
        path = f"{out}/{c['id']}.png"
        if os.path.exists(path):
            continue
        body = json.dumps({"model": "muse-image-1.0", "prompt": f"{c['text']} {P['style']}", "n": 1, "size": "1024x1536", "output_format": "png"}).encode()
        t0 = time.time()
        req = urllib.request.Request(e["META_BASE_URL"].rstrip("/") + "/images/generations", body, {"content-type": "application/json", "authorization": "Bearer " + e["META_API_KEY"]})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
            open(path, "wb").write(base64.b64decode(r["data"][0]["b64_json"]))
            runs.append({"id": c["id"], "seconds": round(time.time() - t0, 1), "usage": r.get("usage"), "ok": True})
        except Exception as ex:
            runs.append({"id": c["id"], "seconds": round(time.time() - t0, 1), "ok": False, "error": str(ex)[:300]})
        print(runs[-1], flush=True)
    json.dump(runs, open(f"{out}/muse_runs.json", "w"), indent=2)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
