"""Motion from you (CC-222): a short filmed clip of one move becomes a gated clip for the game's "My move" slot.

    python pipelines/my_move.py --video clip.mp4 --start 45.5 --end 50.5 --id roll-lp --move roll \
        --credit "Learn Parkour : Basic Jump Roll, London Parkour (CC BY)" [--discard]

Stages (each writes under data/eval/motion-from-you/<id>/ or outside git in $CC_ASSETS_DIR/work/<id>/):
  1 cut      the range is cut at the video's own constant frame rate, frames carry their own times
  2 measure  Modal L4: faces and people blurred first, then SAM 3D Body, then MHR to SOMA (video_to_motion/run_clip.py)
  3 post     30 joints in the world, smoothing, fixed bone lengths, floor from the feet, contacts (video_to_motion/post.py)
  4 fit      the move check finds the move inside the range, the clip is trimmed, repaired, run through the plausibility gate,
             and written in the format of public/assets/motion; only a clip that passes both checks is marked playable
  5 discard  (--discard) the frames, blurred frames and per-frame body numbers are deleted: only the 30 joints stay

The pipeline never scores the person: it reports whether the clip is a plausible body doing the move, not how well they did it.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
ASSETS = Path(os.environ.get("CC_ASSETS_DIR", REPO.parent / "conquercourse-assets"))
os.environ["CC_ASSETS_DIR"] = str(ASSETS)
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "video_to_motion"))
from ccpipe import gate as G, movecheck, repairs  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import NAMES  # noqa: E402

WORK = ASSETS / "work"
EVAL = REPO / "data/eval/motion-from-you"
OUT = REPO / "public/assets/experiments/mymove"
L4_PER_SECOND = 0.000222          # USD, Modal list price for an L4 (docs/dev-setup.md); an estimate, not a bill
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,30}$")
MOVES = {"roll": "roll"}          # move type -> key in movecheck.CHECKS; one move type in this slice


def say(msg):
    print(f"[my-move] {msg}", flush=True)


def stage_cut(video, start, end, stem):
    from cut_frames import main as cut_frames
    d = WORK / stem
    seg = d / "segment.mp4"
    d.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(end - start), "-i", str(video),
                    "-an", "-c:v", "libx264", "-crf", "12", "-preset", "fast", str(seg)], check=True)
    cut_frames(seg, d / "frames", 1920)


def stage_measure(stem):
    import run_clip
    run_clip.main(stem, EVAL.parent / "motion-from-you")


def stage_post(stem, frac):
    import post
    post.main(stem, eval_dir=EVAL, frac=frac)


def fit(stem, move, credit, source):
    """motion.json (30 joints, world) -> a clip in the game's format with its gate and move-check reports."""
    m = json.loads((EVAL / stem / "motion.json").read_text())
    f = np.array(m["frames"])[:, [m["names"].index(n) for n in NAMES]]
    clip = G.clip_from_times(f, np.array(m["times"]))
    check = MOVES[move]
    ok_raw, nums_raw, window = movecheck.CHECKS[check](clip)
    notes = {"raw_move_check": {"ok": bool(ok_raw), **nums_raw}}
    lo = 0
    if window is not None:
        lo = max(0, window[0] - int(round(0.1 * clip.fps)))      # the same cut movecheck.trim makes
        clip = movecheck.trim(clip, window)
    ok_move, nums, _ = movecheck.CHECKS[check](clip)
    fixed, log = repairs.repair(clip)
    report = G.run_gate(fixed)
    playable = bool(report["pass"] and ok_move)
    out = fixed.copy(id=stem, move=move, source=source, gate=report, repairs=log, credit=credit,
                     move_check={"ok": bool(ok_move), **nums}, playable=playable, kind="my-move",
                     source_frames=[int(m.get("first_frame", 0)) + lo, int(m.get("first_frame", 0)) + lo + clip.n - 1],
                     privacy="made from joint positions only; no frame, face or body shape is stored")
    return out, notes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video")
    ap.add_argument("--start", type=float)
    ap.add_argument("--end", type=float)
    ap.add_argument("--id", required=True)
    ap.add_argument("--move", default="roll", choices=sorted(MOVES))
    ap.add_argument("--credit", default="")
    ap.add_argument("--source", default="a person's own clip")
    ap.add_argument("--min-size", type=float, default=0.35, help="smallest person height, as a share of their usual height, that is still kept (one person in frame, so a low value is safe)")
    ap.add_argument("--from-stage", default="cut", choices=["cut", "measure", "post", "fit"])
    ap.add_argument("--discard", action="store_true", help="delete frames and per-frame body numbers when done")
    a = ap.parse_args()
    if not ID_RE.match(a.id):
        sys.exit("id must be lowercase letters, digits and dashes (1 to 31 characters)")
    stem = a.id
    EVAL.mkdir(parents=True, exist_ok=True)
    (EVAL / stem).mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    order = ["cut", "measure", "post", "fit"]
    t = {}
    for st in order[order.index(a.from_stage):]:
        t0 = time.time()
        say(f"stage {st}")
        if st == "cut":
            stage_cut(a.video, a.start, a.end, stem)
        elif st == "measure":
            stage_measure(stem)
        elif st == "post":
            stage_post(stem, a.min_size)
        else:
            clip, notes = fit(stem, a.move, a.credit, a.source)
            clip.save(OUT / f"{stem}.json")
            (EVAL / stem / "fit.json").write_text(json.dumps({"playable": clip.meta["playable"], "gate": clip.meta["gate"],
                                                              "move_check": clip.meta["move_check"], **notes}, indent=2, default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o)))
            say(f"playable={clip.meta['playable']} gate={clip.meta['gate']['pass']} move_check={clip.meta['move_check']['ok']}")
        t[st] = round(time.time() - t0, 1)
    run = {"id": stem, "move": a.move, "stage_wall_seconds": t, "modal_l4_usd_per_second": L4_PER_SECOND,
           "credit": a.credit, "source": a.source}
    mr = EVAL / stem / "modal_run.json"
    if mr.exists():
        mj = json.loads(mr.read_text())
        run["modal"] = {k: mj.get(k) for k in ("frames", "frames_measured", "wall_s", "container_gpu_seconds_estimate", "l4_cost_estimate_usd") if k in mj}
    (EVAL / stem / "run.json").write_text(json.dumps(run, indent=2))
    if a.discard:
        for sub in ("frames", "masked", "segment.mp4", "measured.json", "soma.json"):
            p = WORK / stem / sub
            shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
        say("discarded frames, blurred frames and per-frame body numbers")


if __name__ == "__main__":
    main()
