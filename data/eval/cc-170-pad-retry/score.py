"""Score before vs after (CC-170). Run after both rounds are baked: python3 data/eval/cc-170-pad-retry/score.py
Usable = the baked mesh keeps the shape of the same object lifted from the whole photo (CC-110): width-to-height within a factor of 1.43 of it, and tilt under 10 degrees."""
import json, os, glob
D = "data/eval/cc-170-pad-retry"
REF = {}
for p in glob.glob("data/eval/cc-110-real-objects/r*/*/mesh.json"):
    REF[p.split("/")[-2]] = json.load(open(p))  # later rounds win; gabion-wall comes from r3 (padded) and is the only reference for it
rows = []
for ph in json.load(open(f"{D}/photos.json")):
    if not (os.path.exists(f"{D}/before/{ph['photo']}/mesh.json") and os.path.exists(f"{D}/after/{ph['photo']}/mesh.json")):
        continue  # no pair (Modal mask call kept dropping)
    name = ph["photo"]
    ref = REF[ph["from"]]
    row = {"photo": name, "reference_w2h": ref["width_to_height"], "reference_tilt": ref["tilt_deg"]}
    for rnd in ("before", "after"):
        e = json.load(open(f"{D}/{rnd}/{name}/entry.json"))
        m = json.load(open(f"{D}/{rnd}/{name}/mesh.json"))
        ratio = m["width_to_height"] / ref["width_to_height"]
        row[rnd] = {"w2h": m["width_to_height"], "ratio_to_reference": round(ratio, 2), "tilt_deg": m["tilt_deg"], "padded": e["padretry"]["padded"],
                    "touches_border": e["padretry"]["touches"], "max_border_share": round(max(e["padretry"]["border"].values()), 2),
                    "usable": bool(1 / 1.43 <= ratio <= 1.43 and m["tilt_deg"] < 10), "tool_check_bad": e["padretry"]["bad"]}
    rows.append(row)
s = {"photos": len(rows), "touch_border": sum(r["after"]["touches_border"] for r in rows),
     "usable_before": sum(r["before"]["usable"] for r in rows), "usable_after": sum(r["after"]["usable"] for r in rows),
     "rescued": [r["photo"] for r in rows if not r["before"]["usable"] and r["after"]["usable"]],
     "made_worse": [r["photo"] for r in rows if r["before"]["usable"] and not r["after"]["usable"]],
     "still_bad": [r["photo"] for r in rows if not r["after"]["usable"]]}
json.dump({"summary": s, "rows": rows}, open(f"{D}/scores.json", "w"), indent=2)
print(json.dumps(s, indent=2))
for r in rows:
    print(f"{r['photo']:28} ref {r['reference_w2h']:.2f}  before {r['before']['w2h']:.2f} ({'ok' if r['before']['usable'] else 'BAD'})  after {r['after']['w2h']:.2f} ({'ok' if r['after']['usable'] else 'BAD'})  border {r['before']['max_border_share']}")
