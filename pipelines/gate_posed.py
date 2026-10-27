"""Run the plausibility gate on joint positions exported from the posed Rookie (CC-16).

Usage: uv run --no-project --with numpy python -I pipelines/gate_posed.py data/eval/cc-16-rookies/posed-a.json [...]
Input: {"fps": 30, "frames": [frame][30][x, y, z]} in the clips' axes (run +z, left +x)."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.gate import run_gate  # noqa: E402

for path in sys.argv[1:]:
    posed = json.load(open(path))
    report = run_gate(Clip(posed["frames"], posed["fps"]))
    out = path.replace("posed-", "gate-")
    with open(out, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    bad = [k for sec in ("hard", "soft") for k, r in report[sec].items() if not r["ok"]]
    print(path, "PASS" if report["pass"] else "FAIL", "failed:", bad or "none")
    for sec in ("hard", "soft"):
        for k, r in report[sec].items():
            print(f"  {sec} {k}: {r['value']} ({r['limit']}) {r['note']}")
