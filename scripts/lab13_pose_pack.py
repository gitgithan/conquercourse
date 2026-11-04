"""Lab 13 (Video to motion): turn the pose finder's raw output into a small recorded pose pack.

Usage: python scripts/lab13_pose_pack.py STEM [STEM ...]     (default: roll-lp-crouch roll-lp-stand)

Reads the raw output of the real Modal run (SAM 3D Body keypoints and the MHR to SOMA joints; outside git, in the
assets work folder), and writes, for each clip, a track that is the pose finder's answer turned to face +z and set on
the floor, and nothing else: no frame smoothing, no one-length-per-bone step, no repairs. Lab 13 runs those steps itself.
Also runs the Python plausibility gate on the track, so the page's TypeScript gate can be checked against it.
Never calls a GPU. Pictures are not stored, only numbers.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "pipelines" / "video_to_motion"))
os.environ.setdefault("CC_ASSETS_DIR", str(REPO.parent / "conquercourse-assets"))
import post as P  # noqa: E402
from joints import IDX, NAMES, PARENTS, j  # noqa: E402
from ccpipe import gate as G  # noqa: E402

OUT = REPO / "public/assets/lab/motion/real"
EVAL = REPO / "data/eval/cc-133-lab13-pose"
LABELS = {
    "roll-lp-crouch": ("Crouch roll, measured by the pose finder (no cleaning)", "Learn Parkour : Basic Crouch Roll, London Parkour (CC BY)", "203.5 to 208.5 s"),
    "roll-lp-stand": ("Standing roll, measured by the pose finder (no cleaning)", "Learn Parkour : Basic Crouch Roll, London Parkour (CC BY)", "39.2 to 43.2 s"),
}


def norm(o):
    """Numbers the way JavaScript prints them (2.0 as 2, no negative zero), so the files are already formatted."""
    if isinstance(o, float):
        o = 0.0 if o == 0 else o
        return int(o) if o == int(o) else o
    if isinstance(o, list):
        return [norm(x) for x in o]
    if isinstance(o, dict):
        return {k: norm(v) for k, v in o.items()}
    return o


def turn_and_level(world, t):
    """post.orient_and_level without its smoothing and bone-length steps."""
    hips = j(world, "Hips")
    trav = hips[-1] - hips[0]
    trav[1] = 0
    if np.linalg.norm(trav) < 0.5:
        left = j(world, "LeftLeg") - j(world, "RightLeg")
        left[:, 1] = 0
        fwd = np.cross(left.mean(0), [0, 1, 0])
    else:
        fwd = trav
    fwd = fwd / np.linalg.norm(fwd)
    ang = np.arctan2(fwd[0], fwd[2])
    c, s = np.cos(ang), np.sin(ang)
    w = world @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]]).T
    w, floor = P.level_floor(w, t)
    h = j(w, "Hips")
    w[:, :, 0] -= h[0, 0]
    w[:, :, 2] -= h[0, 2]
    return w, floor


def main(stems):
    OUT.mkdir(parents=True, exist_ok=True)
    EVAL.mkdir(parents=True, exist_ok=True)
    manifest = {"about": "Raw tracks from the pose finder (SAM 3D Body, then MHR to SOMA) run on Modal at build time. Joints in metres, y up, run along +z, left on +x. Not smoothed, not repaired.", "clips": []}
    for stem in stems:
        times, world, ok, (a, b), diag = P.build(stem)
        t = np.array(times["times"])[a:b]
        w, floor = turn_and_level(world[a:b], t)
        meas = json.loads((P.WORK / stem / "measured.json").read_text())[a:b]
        fps = (len(t) - 1) / (t[-1] - t[0])
        gate = G.run_gate_times(w, t)
        label, credit, window = LABELS[stem]
        clip = {"names": NAMES, "parents": PARENTS, "fps": fps, "frames": np.round(w, 3).tolist(), "id": stem + "-raw", "source": credit}
        text = json.dumps(norm(clip), indent=2) + "\n"
        (OUT / f"{stem}-raw.json").write_text(text)
        sha = hashlib.sha256(text.encode()).hexdigest()
        spread = [float(np.linalg.norm(w[i + 1] - w[i], axis=1).mean()) for i in range(len(w) - 1)]
        entry = {"id": stem + "-raw", "label": label, "file": f"{stem}-raw.json", "sha256": sha, "bytes": len(text), "frames": int(len(w)), "fps": round(float(fps), 3),
                 "credit": credit, "source_window": window, "frames_measured": int(len(ok)), "frames_in_film": int(times["n"] if "n_total" not in times else times["n_total"]),
                 "athlete_frames": [int(a), int(b)], "focal_px": round(float(np.median([m["focal"] for m in meas])), 1),
                 "python_gate": {"pass": bool(gate["pass"]), "hard": {k: {"ok": bool(v["ok"]), "value": v["value"]} for k, v in gate["hard"].items()},
                                 "soft": {k: {"ok": bool(v["ok"]), "value": v["value"]} for k, v in gate["soft"].items()}},
                 "mean_joint_step_m": round(float(np.mean(spread)), 4), "floor": floor, "bridged_frames": diag["bridged_frames"]}
        manifest["clips"].append(entry)
        print(stem, "frames", len(w), "bytes", len(text), "gate pass", gate["pass"], {k: v["ok"] for k, v in gate["hard"].items()}, {k: (v["ok"], v["value"]) for k, v in gate["soft"].items()})
    (OUT / "manifest.json").write_text(json.dumps(norm(manifest), indent=2, default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o)) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:] or ["roll-lp-crouch", "roll-lp-stand"])
