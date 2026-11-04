"""Computer vision: the same keep-or-drop rule as src/labs/vision/rule.ts, in Python.
usage: lab_vision_rule.py TABLE.txt SCORECUT,MINSIZE,MAXMASKED [...]   -> one JSON line per setting with the kept and missed counts.
tests/lab-vision.test.ts runs it and the TypeScript rule on the same table and demands equal counts.
The table is the one the page loads (public/assets/lab/vision/scores.txt).
"""
import json, sys

MAX_BOX = 0.25


def parse(path):
    photos = []
    for line in open(path, encoding="utf-8").read().split("\n"):
        if not line or line.startswith("#"):
            continue
        pid, u, f, t = line.split("|")
        finds = [tuple(float(x) for x in s.split(",")) for s in f.split(";")] if f else []
        truth = [tuple(float(x) for x in s.split(",")) for s in t.split(";")] if t else []
        photos.append((pid, finds, [(a, int(b)) for a, b in truth]))
    return photos


def summarize(photos, score_cut, min_size, max_masked):
    kept = people = covered = false_masks = 0
    for _, finds, truth in photos:
        active = [s >= score_cut and b >= min_size for s, b, _ in finds]
        masked = biggest = 0.0
        for i, (s, b, m) in enumerate(finds):
            if active[i]:
                masked += m
                biggest = max(biggest, b)
        masked = min(masked, 1.0)
        if not (masked <= max_masked and biggest <= MAX_BOX):
            continue
        kept += 1
        matched = {f for _, f in truth if f >= 0}
        people += len(truth)
        covered += sum(1 for _, f in truth if f >= 0 and active[f])
        false_masks += sum(1 for i in range(len(finds)) if active[i] and i not in matched)
    return {"photos": len(photos), "kept": kept, "people": people, "covered": covered, "missed": people - covered, "falseMasks": false_masks}


if __name__ == "__main__":
    photos = parse(sys.argv[1])
    for arg in sys.argv[2:]:
        sc, ms, mm = (float(x) for x in arg.split(","))
        print(json.dumps(summarize(photos, sc, ms, mm)))
