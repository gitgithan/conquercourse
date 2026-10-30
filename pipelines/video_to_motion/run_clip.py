"""Drive one clip: privacy + measure in chunks across up to 3 containers, then MHR to SOMA.

Usage: python run_clip.py CLIP_STEM
Reads frames from the work dir (outside git); writes masked frames and big raw files there;
writes small results to data/eval/cc-26-pexels-motion/CLIP_STEM/.
"""
import json
import os
import sys
import time
from pathlib import Path

import modal

sys.path.insert(0, str(Path(__file__).parent))
import modal_app as M

WORK = Path(os.environ.get("CC_ASSETS_DIR", Path(__file__).resolve().parents[3] / "conquercourse-assets")) / "work"
EVAL = Path(os.environ.get("CC_EVAL_DIR", Path(__file__).resolve().parents[2] / "data/eval/cc-26-pexels-motion"))
CHUNK = 30
L4_PER_SECOND = 0.000222  # USD, Modal list price for an L4 (checked at run time in run.json notes)


def wait(call, what, give_up_s=2400):
    """Wait for a spawned Modal call by short polls: a dropped connection (seen from the laptop on 2026-10-30, it killed
    three runs that used one long .remote() call) is retried, because the call itself keeps running in detached mode."""
    t0 = time.time()
    while True:
        try:
            return call.get(timeout=20)
        except TimeoutError:
            pass
        except Exception as e:  # noqa: BLE001  (connection lost, SSL closed)
            print(f"[run_clip] {what}: {type(e).__name__}, polling again", flush=True)
            time.sleep(5)
        if time.time() - t0 > give_up_s:
            raise RuntimeError(f"{what}: no answer in {give_up_s} s")


def main(stem, eval_dir=None):
    """eval_dir: folder that holds one subfolder per clip (default: the CC-26 folder)."""
    t0 = time.time()
    fdir = WORK / stem / "frames"
    times = json.loads((fdir / "times.json").read_text())
    n = times["n"]
    frames = [(fdir / f"f{i:05d}.jpg").read_bytes() for i in range(n)]
    out_small = Path(eval_dir or EVAL) / stem
    out_small.mkdir(parents=True, exist_ok=True)
    (WORK / stem / "masked").mkdir(exist_ok=True)
    with modal.enable_output(), M.app.run(detach=True):
        w = M.Worker()
        spread = [frames[i] for i in range(0, n, max(1, n // 5))][:5]
        fov = wait(w.estimate_focal.spawn(spread), 'focal')
        focal = fov.get("focal_px")
        chunks = [(frames[s:s + CHUNK], s, focal) for s in range(0, n, CHUNK)]
        calls = [w.privacy_and_measure.spawn(*c) for c in chunks]
        res = [wait(c, f'chunk {i}') for i, c in enumerate(calls)]
        measured, receipt, secs = [], [], []
        for r, (_, s, _) in zip(res, chunks):
            measured += r["measured"]
            receipt += r["receipt"]
            secs.append({"first": s, "seconds": r["seconds"], "load_s": r["load_s"]})
            for k, b in enumerate(r["masked"]):
                (WORK / stem / "masked" / f"f{s + k:05d}.jpg").write_bytes(b)
        ok = [m for m in measured if m["ok"]]
        soma = wait(w.mhr_to_soma.spawn([m["shape"] for m in ok], [m["model_params"] for m in ok], None), 'soma')
    (WORK / stem / "measured.json").write_text(json.dumps(measured))
    (WORK / stem / "soma.json").write_text(json.dumps(soma))
    (out_small / "privacy_receipt.json").write_text(json.dumps({
        "prompts": {"person": 0.5, "face": 0.4, "license plate": 0.4},
        "frames": n, "frames_with_a_face": sum(1 for r in receipt if r["faces"]),
        "frames_with_people": sum(1 for r in receipt if r["people"]),
        "total_faces": sum(r["faces"] for r in receipt), "total_plates": sum(r["plates"] for r in receipt),
        "per_frame": receipt}))
    gpu_s = sum(s["seconds"] + s["load_s"] for s in secs) + soma["seconds"] + 60
    (out_small / "modal_run.json").write_text(json.dumps({
        "clip": stem, "frames": n, "frames_measured": len(ok), "focal": fov,
        "chunks": secs, "soma_seconds": soma["seconds"], "soma_err_cm": soma["vertex_err_cm"],
        "wall_s": time.time() - t0, "container_gpu_seconds_estimate": gpu_s,
        "l4_cost_estimate_usd": gpu_s * L4_PER_SECOND}, indent=1))
    print(stem, "ok", len(ok), "/", n, "gpu_s~", round(gpu_s), "usd~", round(gpu_s * L4_PER_SECOND, 2))


if __name__ == "__main__":
    main(sys.argv[1])
