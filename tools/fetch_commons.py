"""Download openly licensed photos from Wikimedia Commons with their licence data.

usage: fetch_commons.py OUT_DIR TITLE [TITLE ...]
Writes parkNN.jpg (1280 px wide) and sources.json (title, author, licence, page URL).
"""
import io, json, sys, time, urllib.parse, urllib.request

UA = {"User-Agent": "cc-spike/0.1 (research)"}


def get(url):
    for wait in (0, 5, 15, 40):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except Exception as e:
            err = e
    raise err


def main(out, titles):
    sources = []
    for n, t in enumerate(titles, 1):
        q = urllib.parse.urlencode({
            "action": "query", "titles": "File:" + t, "prop": "imageinfo", "format": "json",
            "iiprop": "extmetadata|url|size", "iiurlwidth": 1280})
        page = next(iter(json.loads(get("https://commons.wikimedia.org/w/api.php?" + q))["query"]["pages"].values()))
        ii = page["imageinfo"][0]
        m = ii["extmetadata"]
        name = f"park{n:02d}.jpg"
        open(f"{out}/{name}", "wb").write(get(ii["thumburl"]))
        strip = lambda s: __import__("re").sub(r"<[^>]+>", "", s).strip()
        sources.append({
            "file": name, "title": t, "page": ii["descriptionurl"],
            "author": strip(m.get("Artist", {}).get("value", "")),
            "licence": m["LicenseShortName"]["value"], "licence_url": m.get("LicenseUrl", {}).get("value", ""),
            "original_size": [ii["width"], ii["height"]], "served_width": ii["thumbwidth"]})
        print(name, sources[-1]["licence"], sources[-1]["author"][:40])
        time.sleep(2)
    json.dump(sources, open(f"{out}/sources.json", "w"), indent=1, ensure_ascii=False)


main(sys.argv[1], sys.argv[2:])
