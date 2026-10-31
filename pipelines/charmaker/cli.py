"""Make one character from the command line (CC-108): the same `maker.run` the server's job uses, with the real route A providers.
usage: python -m charmaker.cli OUT_DIR "a friendly robot frog" [--seed 42] [--mock] [--tripo]
Writes OUT_DIR/<slug>/{picture.png, mask.png, character.glb, thumb.webp, run.json}. Keys come from the environment or the owner's env file and are never printed."""
from __future__ import annotations
import argparse, json, os, re, sys, time

from . import maker as mk
from .contracts import Request
from .providers import PROVIDERS


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("prompt")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--provider", default="route-a")
    ap.add_argument("--mock", action="store_true", help="no network: the mock maker")
    ap.add_argument("--fail-mesh", action="store_true", help="mock only: make the 3D step fail every time (shows route C)")
    a = ap.parse_args(argv)
    if a.mock:
        from .mock import MockMaker
        m = MockMaker(mesh_fails=3 if a.fail_mesh else 0)
    else:
        m = PROVIDERS[a.provider]()
    slug = re.sub(r"[^a-z0-9]+", "-", a.prompt.lower()).strip("-")[:40]
    d = os.path.join(a.out, slug); os.makedirs(d, exist_ok=True)
    log = []
    t0 = time.time()
    try:
        r = mk.run(m, Request(prompt=a.prompt, seed=a.seed), progress=lambda s, i: (log.append({"stage": s, "t": round(time.time() - t0, 1), **i}), print(f"[{time.time() - t0:5.1f}s] {s} {i.get('attempt', '')}", flush=True)))
    except mk.Failed as e:
        json.dump({"prompt": a.prompt, "ok": False, "stage": e.stage, "why": e.why, "refund": e.refund, "log": log}, open(os.path.join(d, "run.json"), "w"), indent=2)
        print("FAILED", e); return 1
    open(os.path.join(d, "character.glb"), "wb").write(r.package.glb)
    open(os.path.join(d, "thumb.webp"), "wb").write(r.package.thumb_webp)
    open(os.path.join(d, "picture.png"), "wb").write(r.picture_png)
    if r.mask_png:
        open(os.path.join(d, "mask.png"), "wb").write(r.mask_png)
    json.dump({"prompt": a.prompt, "ok": True, "id": r.package.id, "route": r.route, "provider": r.provider, "bytes": len(r.package.glb), "thumb_bytes": len(r.package.thumb_webp),
               "attempts": r.attempts, "seconds": r.seconds, "wall_s": round(time.time() - t0, 1), "cost_usd": round(r.cost_usd, 4), "stretch": {k: list(v) for k, v in r.stretch.items()},
               "notes": r.notes, "meta": {k: v for k, v in r.package.meta.items() if k not in ("owner",)}, "log": log}, open(os.path.join(d, "run.json"), "w"), indent=2, default=str)
    print(f"OK {r.package.id} route {r.route} {len(r.package.glb)} bytes cost ${r.cost_usd:.4f} -> {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
