"""Run the shared plausibility gate again on committed motion.json files (no GPU, no frames needed).

Usage: python regate.py EVAL_DIR [CLIP ...]   writes EVAL_DIR/CLIP/gate_shared.json
"""
import json
import sys
from pathlib import Path

import numpy as np

from joints import NAMES  # also puts pipelines/ on the path for ccpipe
from ccpipe import gate  # noqa: E402
from post import SUPPORTED_BY  # noqa: E402


def regate(motion_path, supported_by=None):
    m = json.loads(Path(motion_path).read_text())
    # CC-26 files list the 30 joints in the old video_to_motion order; the names travel with the file, so pick by name
    assert sorted(m["names"]) == sorted(NAMES), "motion.json must hold the 30 shared joints"
    frames = np.array(m["frames"])[:, [m["names"].index(n) for n in NAMES]]
    rep = gate.run_gate_times(frames, m["times"], supported_by=supported_by)
    free = gate.run_gate_times(frames, m["times"])
    return {"gate": "ccpipe.gate (shared)", "supportedBy": supported_by, "verdict": "PASS" if rep["pass"] else "FAIL",
            "failed_rules": gate.failures(rep), "report": rep, "free_flight_report": free}


if __name__ == "__main__":
    root = Path(sys.argv[1])
    for d in sorted(p for p in root.iterdir() if (p / "motion.json").exists()):
        if len(sys.argv) > 2 and d.name not in sys.argv[2:]:
            continue
        out = regate(d / "motion.json", SUPPORTED_BY.get(d.name))
        (d / "gate_shared.json").write_text(json.dumps(out, indent=2))
        print(d.name, out["verdict"], out["failed_rules"])
