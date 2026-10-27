"""Video ingest (CC-29): a CC-licensed video range becomes obstacles, a measured move and a move recipe.

    python pipelines/ingest_video.py <url> --start <s> --end <s> --id <name>

Stages (each result is cached, so a re-run costs nothing for what is done):
  1 licence   refuse anything that is not CC BY or CC0; refuse text that points at children
  2 cut       download (outside git), cut the range at a constant frame rate, frames with the video's own times
  3 adult     faces pixelated on Modal first, then a Meta vision call; anything but a clear "all adults" skips the segment
  4 measure   faces and plates masked, people blurred, SAM 3D Body, MHR to SOMA on Modal (reuses video_to_motion)
  5 post      30 joints in the world, contacts, repairs, the shared plausibility gate (reuses video_to_motion/post.py)
  6 seg       SAM 3.1 noun phrases on people-blurred frames (reuses sam31_park.py and server/sam-proxy.mjs)
  7 fit       each object becomes an obstacle primitive with metres, a scale source and an uncertainty
  8 recipe    the move recipe, the contact sheet, a GIF, the README (so-what first) and run.json
`--scan` instead lists obstacles and moves with time ranges over the whole range (faces masked, a Meta vision call per 12 frames).
`--from-stage seg` starts at stage 6 on files that already exist (used for fixtures). Keys come from the environment, never the repo.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
ASSETS = Path(os.environ.get("CC_ASSETS_DIR", REPO.parent / "conquercourse-assets"))
os.environ["CC_ASSETS_DIR"] = str(ASSETS)           # video_to_motion reads it at import
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "video_to_motion"))
from ccpipe import gate as G, primitives as P, recipe as R, render, vision  # noqa: E402
from ccpipe import ingest_source as S  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import NAMES  # noqa: E402

PHRASES = ["wall", "curved wall", "ramp", "platform", "bar", "rope", "ledge", "box", "steps", "pole"]
SEG_FRAMES = 3                       # frames per clip sent to SAM 3.1
ADULT_FRAMES = 6
L4_PER_SECOND = 0.000222             # USD, Modal list price (docs/dev-setup.md); recorded in run.json
SAM_PER_IMAGE = 2.50 / 1000
SECONDS_PER_FRAME = 3.5              # all-in container seconds per frame, from CC-26 (52.8 min for 964 frames)
FIXED_SECONDS = 150                  # adult check, focal length, MHR to SOMA
META_CALL_USD = 0.06                 # one vision call with a few images (docs/pipelines.md: about 10,000 tokens)
STAGES = ["licence", "cut", "adult", "measure", "post", "seg", "fit", "recipe"]


def estimate(n_frames, n_phrases=len(PHRASES)):
    """Expected spend, stated before any paid step."""
    gpu_s = FIXED_SECONDS + SECONDS_PER_FRAME * n_frames
    sam_images = SEG_FRAMES * n_phrases
    parts = {"modal_l4": round(gpu_s * L4_PER_SECOND, 3), "sam31": round(sam_images * SAM_PER_IMAGE, 3), "meta_vision": META_CALL_USD}
    return {"frames": n_frames, "gpu_container_seconds": round(gpu_s), "gpu_minutes": round(gpu_s / 60, 1), "sam31_images": sam_images, "usd": parts, "usd_total": round(sum(parts.values()), 3)}


def say(msg):
    print(f"[ingest] {msg}", flush=True)


def load_motion(path):
    """motion.json -> frames in the shared joint order (files from older runs list the joints in another order; names travel with the file)."""
    m = json.loads(Path(path).read_text())
    frames = np.array(m["frames"])[:, [m["names"].index(n) for n in NAMES]]
    return frames, np.array(m["times"]), m


def start_proxy():
    """The SAM 3.1 proxy holds the key; start it if nothing answers on its port. Returns the process or None."""
    url = "http://127.0.0.1:8787"
    try:
        urllib.request.urlopen(urllib.request.Request(url + "/segment", b"{}", {"content-type": "application/json"}), timeout=3)
        return None
    except urllib.error.HTTPError:
        return None                                   # it answered (400): already running
    except Exception:
        pass
    env = dict(os.environ)
    env_file = Path(os.environ.get("META_ENV_FILE", Path.home() / ".config/ninja/meta.env"))
    if "META_API_KEY" not in env and env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    p = subprocess.Popen(["node", str(REPO / "server/sam-proxy.mjs")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.25)
        try:
            urllib.request.urlopen(urllib.request.Request(url + "/segment", b"{}", {"content-type": "application/json"}), timeout=2)
        except urllib.error.HTTPError:
            return p
        except Exception:
            continue
    p.kill()
    raise RuntimeError("the SAM proxy did not start (META_API_KEY missing?)")


def edge_points(mask, ox, oy, facing):
    """The mask's front edge: per row, the pixel nearest the side the athlete comes from (facing +1 = moving right in the picture)."""
    pts = []
    for r in range(mask.shape[0]):
        cols = np.nonzero(mask[r])[0]
        if len(cols):
            pts.append((ox + (cols.min() if facing > 0 else cols.max()), oy + r))
    return np.array(pts, float)


def floor_and_person(measured, a, b):
    """Floor row and standing height in pixels from the person boxes in the first frames of the athlete's stretch.

    The body model's box is the person box grown by 10 % each way, so the grow is undone here."""
    rows, heights, xs = [], [], []
    for m in measured[a:min(b, a + 12)]:
        if m.get("ok"):
            x1, y1, x2, y2 = m["bbox"]
            h = (y2 - y1) / 1.2
            rows.append(y2 - h * 0.1)
            heights.append(h)
    ends = [(m["bbox"][0] + m["bbox"][2]) / 2 for m in (measured[a], measured[b - 1]) if m.get("ok")]
    facing = 1 if len(ends) < 2 or ends[1] >= ends[0] else -1
    return (float(np.median(rows)) if rows else None), (float(np.median(heights)) if heights else None), facing


def write_json(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o)) + "\n")


def so_what(r):
    """The README's first section, in project terms."""
    if r.get("skipped"):
        return [f"- **Result for the game:** this segment was skipped, so nothing from it can be used.", f"- **Why:** {r['skipped']}",
                "- **Recommendation:** use a different clip of the move; do not override the check.", "- **Next step:** pick another segment or video and re-run."]
    gate = r["gate"]
    rec = r["recipe"]
    prim = rec.get("obstacle") or {}
    move = rec["move"]
    out = []
    if gate["verdict"] == "PASS":
        out.append(f"- **Result for the game:** a filmed `{move}` passed the plausibility gate and is a candidate source for the Rookies' move library (not shown yet: it still needs the blind look-test).")
    else:
        out.append(f"- **Result for the game:** a filmed `{move}` was measured, but it **failed the plausibility gate** ({', '.join(gate['failed_rules'])}), so it is not shown and cannot be a starter clip.")
    if prim:
        u = (prim.get("sizeUncertainty") or {}).get("height")
        out.append(f"- **Obstacle:** a `{prim['type']}` about {prim['height_m']:.1f} m high" + (f" (± {100 * u:.0f} %)" if u else "") + f", scale from {prim['scale']['source']}; the move is written as a recipe other obstacles can reuse.")
    chk = r.get("starter_move_check")
    if chk:
        out.append(f"- **Wall-run check (the one CC-17's text-only Kimodo clips failed 36 of 36):** {'passes' if chk['passes'] else 'does not pass'} ({chk['numbers']})" + ("" if gate['verdict'] == 'PASS' else "; the clip failed the gate, so these numbers only show what was measured") + ".")
    if gate["verdict"] == "PASS":
        out.append("- **Recommendation:** use the contact points (plant height, grip height, timing) as targets for Kimodo, and keep the measured motion as the reference to compare against.")
    else:
        out.append("- **Recommendation:** use only the contact points as rough targets for Kimodo (they are measurements of where hands and feet went); do not play this motion back.")
    out.append("- **Next step:** feed the recipe's contact events to Kimodo as targets and run the move check on what it makes; re-film or re-cut if the gate failure is a measurement problem (camera moves, scale).")
    return out


def write_readme(out, r):
    L = [f"# Video ingest: {r['id']}", "", f"*Serves the Park beat and the Warped Wall: a filmed move becomes a measured move and a reusable recipe (CC-29). Run {r['date']}.*", "", "## So what"]
    L += so_what(r)
    L += ["", "## Source"]
    s = r["source"]
    L += [f"- **Video:** [{s.get('title')}]({s.get('url')}) by {s.get('uploader')}", f"- **Licence:** {s.get('licence')}", f"- **Range:** {s['range_s'][0]}-{s['range_s'][1]} s, fetched {s.get('fetched')}",
          "- **Kept outside git:** the video and frames (`../conquercourse-assets/`, with `SHA256SUMS`)"]
    if r.get("skipped"):
        L += ["", "## Skipped", f"- {r['skipped']}"]
    else:
        a = r["adult_check"]
        L += ["", "## Safety", f"- **Adult check:** {'passed' if a['pass'] else 'failed'}: `{json.dumps(a['answer'])}`", "- **Faces:** pixelated before any other model saw a frame; kept pictures also blur the person",
              "", "## Pictures", "- ![obstacles](obstacles_overlay.jpg)", "- ![contact sheet](contact_sheet.jpg)", "- ![move](move.gif)  (passing and failing moves both get a GIF)"]
        L += ["", "## Gate", f"- **Verdict:** {r['gate']['verdict']}" + (f" (failed: {', '.join(r['gate']['failed_rules'])})" if r['gate']['failed_rules'] else ""), "- Rules and numbers: `gate.json`"]
        L += ["", "## Obstacles found (SAM 3.1)"]
        for p in r["primitives"]:
            L.append(f"- `{p['id']}` from \"{p['fit']['phrase']}\" (score {p['fit'].get('score')}): sizes {json.dumps(p['sizes'])}; scale {p['scale']['source']}, size uncertainty {json.dumps(p['sizeUncertainty'])}; {p['fit'].get('note', '')}")
        if not r["primitives"]:
            L.append("- none found for these phrases: " + ", ".join(r["phrases"]))
        rc = r["recipe"]
        L += ["", "## Move recipe (`recipe.json`)", f"- **Move:** `{rc['move']}`; phases: " + ", ".join(f"{p['name']} {p['t'][0]}-{p['t'][1]} s" for p in rc["phases"]),
              f"- **Timing:** {json.dumps(rc['timing'])}", f"- **Reach:** {json.dumps(rc['reach'])}",
              "- **Measured vs guess:** " + "; ".join(f"{k}: {v}" for k, v in rc["provenance"].items())]
        for t in rc["transfer"]:
            L.append(f"- Could transfer to `{t['to']}` ({t['confidence']}): {t['how']}")
    L += ["", "## Cost (actual)"]
    c = r["cost"]
    L += [f"- **Modal L4:** {c.get('gpu_container_seconds', 0)} container seconds, about ${c.get('modal_usd', 0)}", f"- **SAM 3.1:** {c.get('sam31_images', 0)} images, about ${c.get('sam31_usd', 0)}",
          f"- **Meta vision:** about ${c.get('meta_usd', 0)}", f"- **Expected before the run:** {json.dumps(r.get('estimate', 'not computed: stopped earlier'))}"]
    L += ["", "## Files", "- `inputs/source.json`, `inputs/adult_check.json`; `outputs/` (SAM 3.1 responses); `motion.json`, `contacts.json`, `gate.json`, `primitives.json`, `recipe.json`, `run.json`"]
    (Path(out) / "README.md").write_text("\n".join(L) + "\n")


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("url")
    ap.add_argument("--start", type=float, required=True)
    ap.add_argument("--end", type=float, required=True)
    ap.add_argument("--id", required=True)
    ap.add_argument("--info-json", help="a yt-dlp .info.json made elsewhere (when this machine cannot reach the site); with --file")
    ap.add_argument("--file", help="the downloaded video that goes with --info-json")
    ap.add_argument("--cookies", help="a cookies file for yt-dlp, supplied by the product owner")
    ap.add_argument("--supported-by", help="what holds the athlete in a held move (a human-chosen label, like 'a wall')")
    ap.add_argument("--known-height", help="'phrase=metres', e.g. 'curved wall=4.3': scale from an object of known height")
    ap.add_argument("--obstacle", help="the phrase of the obstacle the move is about (default: the one the contacts fit best)")
    ap.add_argument("--view", choices=["side", "oblique"], default="side", help="side: the camera looks across the run (horizontal sizes are metric); oblique: only heights are")
    ap.add_argument("--phrases", default=",".join(PHRASES))
    ap.add_argument("--scan", action="store_true", help="list obstacles and moves with time ranges over the range, then stop")
    ap.add_argument("--scan-step", type=float, default=2.0)
    ap.add_argument("--from-stage", choices=STAGES, default="licence")
    ap.add_argument("--max-usd", type=float, default=3.0, help="stop before any paid step if the estimate is above this")
    ap.add_argument("--eval-dir", default=str(REPO / "data/eval"))
    return ap.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    t_start = time.time()
    out = Path(args.eval_dir) / args.id
    work = ASSETS / "work" / args.id
    vdir = ASSETS / "video" / args.id
    for d in (out / "inputs", out / "outputs"):
        d.mkdir(parents=True, exist_ok=True)
    phrases = [p.strip() for p in args.phrases.split(",") if p.strip()]
    run = {"experiment": args.id, "issue": "CC-29", "date": time.strftime("%Y-%m-%d"), "command": " ".join(["ingest_video.py", args.url, "--start", str(args.start), "--end", str(args.end), "--id", args.id]),
           "phrases": phrases, "stages": {}, "cost": {}}
    start_i = STAGES.index(args.from_stage)
    info = {}
    try:
        # 1 licence ------------------------------------------------------------------------------------------------
        if start_i <= 0:
            if args.info_json:
                info = json.loads(Path(args.info_json).read_text())
            else:
                info = S.fetch_info(args.url, args.cookies)
            run["source"] = S.source_record(info, args.url, args.start, args.end)
            run["licence_check"] = S.check_licence(info)
            hits = S.screen_text_for_minors(info)
            if hits:
                raise S.Refused(f"the title, description or tags mention {hits}: possible children, so the segment is skipped without looking at any frame")
            write_json(out / "inputs/source.json", run["source"])
            say(f"licence ok: {run['licence_check']}")
        else:
            run["source"] = json.loads((out / "inputs/source.json").read_text())
            info = run["source"]
        # estimate (before any paid step) ---------------------------------------------------------------------------
        fps_guess = float(info.get("fps") or 30)
        n_guess = int(round((args.end - args.start) * fps_guess))
        if args.scan:
            # a scan masks one frame per step and never runs SAM 3.1 or the full measure
            scan_est = ((args.end - args.start) / args.scan_step)
            calls = max(1, int(np.ceil(scan_est / 12)))
            gpu_s = FIXED_SECONDS + SECONDS_PER_FRAME * scan_est
            parts = {"modal_l4": round(gpu_s * L4_PER_SECOND, 3), "sam31": 0.0, "meta_vision": round(calls * META_CALL_USD, 3)}
            est = {"frames": round(scan_est), "gpu_container_seconds": round(gpu_s), "gpu_minutes": round(gpu_s / 60, 1), "sam31_images": 0,
                   "usd": parts, "usd_total": round(sum(parts.values()), 3)}
            say(f"scan: {scan_est:.0f} frames masked on Modal, {calls} Meta vision calls")
        else:
            est = estimate(n_guess, len(phrases))
        run["estimate"] = est
        say(f"expected cost before the run: {est['frames']} frames, {est['gpu_minutes']} GPU minutes (about ${est['usd']['modal_l4']}), "
            f"{est['sam31_images']} SAM 3.1 images (${est['usd']['sam31']}), Meta vision (${est['usd']['meta_vision']}); total about ${est['usd_total']}")
        if est["usd_total"] > args.max_usd:
            raise S.Refused(f"expected cost ${est['usd_total']} is above --max-usd {args.max_usd}")
        # 2 cut ----------------------------------------------------------------------------------------------------
        if start_i <= 1:
            vdir.mkdir(parents=True, exist_ok=True)
            src = Path(args.file) if args.file else (vdir / "source.mp4" if (vdir / "source.mp4").exists() else S.download(args.url, vdir, args.cookies))
            if args.file and Path(args.file).resolve() != (vdir / "source.mp4").resolve():
                (vdir / "source.mp4").write_bytes(src.read_bytes())
            if not args.scan:
                clip = S.cut(vdir / "source.mp4", args.start, args.end, vdir / "clip.mp4")
                import cut_frames
                st = cut_frames.probe(clip)
                cut_frames.main(str(clip), str(work / "frames"), min(1920, max(st["width"], st["height"])))   # never upscale a small video
                say(f"cut {args.start}-{args.end} s into {len(list((work / 'frames').glob('f*.jpg')))} frames")
            S.write_sums(vdir)
        # scan mode ------------------------------------------------------------------------------------------------
        if args.scan:
            return scan(args, out, work, vdir, info, run)
        # 3 adult check --------------------------------------------------------------------------------------------
        if start_i <= 2:
            adult(args, out, work, info, run)
        else:
            run["adult_check"] = json.loads((out / "inputs/adult_check.json").read_text())
            run["cost"]["meta_usd"] = run["adult_check"].get("usd", 0)
        if not run["adult_check"]["pass"]:
            raise S.Refused("the adult check did not say 'all adults' with confidence: " + json.dumps(run["adult_check"]["answer"]))
        # 4 measure, 5 post ------------------------------------------------------------------------------------------
        if start_i <= 3:
            import run_clip
            say("measuring on Modal (faces masked first)")
            run_clip.main(args.id, eval_dir=str(Path(args.eval_dir)))
        if start_i <= 4:
            import post
            post.main(args.id, supported_by=args.supported_by, eval_dir=str(Path(args.eval_dir)))
        modal_run = json.loads((out / "modal_run.json").read_text()) if (out / "modal_run.json").exists() else {}
        run["cost"].update(gpu_container_seconds=modal_run.get("container_gpu_seconds_estimate", 0) + run["cost"].get("adult_gpu_seconds", 0),
                           modal_usd=round((modal_run.get("container_gpu_seconds_estimate", 0) + run["cost"].get("adult_gpu_seconds", 0)) * L4_PER_SECOND, 3))
        frames, times, mjson = load_motion(out / "motion.json")
        contacts = json.loads((out / "contacts.json").read_text())
        gate_json = json.loads((out / "gate.json").read_text())
        verdict_gate = G.run_gate_times(frames, times, supported_by=args.supported_by)
        measured = json.loads((work / "measured.json").read_text())
        a, b = gate_json["athlete_frames"]
        # 6 seg, 7 fit ---------------------------------------------------------------------------------------------
        floor_row, person_px, facing = floor_and_person(measured, a, b)
        objs = segment(args, out, work, a, b, phrases, run)
        prims, overlay_objs = fit_objects(args, out, objs, floor_row, person_px, facing, contacts, run)
        write_json(out / "primitives.json", {"schemaVersion": P.SCHEMA_VERSION, "primitives": prims})
        validate_primitives(out / "primitives.json")
        render.obstacle_overlay(work / "masked" / f"f{objs['frames'][len(objs['frames']) // 2]:05d}.jpg", overlay_objs, out / "obstacles_overlay.jpg")
        # 8 recipe -------------------------------------------------------------------------------------------------
        prim = pick_obstacle(prims, contacts, args.obstacle)
        source = {k: run["source"].get(k) for k in ("url", "uploader", "licence", "range_s")} | {"id": args.id}
        recipe = R.build_recipe(frames, times, contacts, prim, source, verdict_gate,
                                scale_note=(prim or {}).get("scale", {}).get("note", ""))
        recipe["transferChecks"] = [dict(target=p["id"], **R.fit_to(recipe, p)) for p in prims if p is not prim]
        write_json(out / "recipe.json", recipe)
        import build_starter
        ok, nums = build_starter.expectation(Clip(frames, (len(times) - 1) / (times[-1] - times[0])), "wall_grab")
        masked = [str(work / "masked" / f"f{gate_json['athlete_frames'][0] + i:05d}.jpg") for i in range(len(frames))]
        kp = [(measured[a + i]["kp2d"] if measured[a + i].get("ok") else None) for i in range(len(frames))]
        render.move_gif(frames, times, contacts, prim, recipe["gate"]["verdict"], masked, kp, out / "move.gif")
        run.update(gate=recipe["gate"], recipe=recipe, primitives=prims, starter_move_check={"passes": bool(ok), "numbers": nums})
    except S.Refused as e:
        run["skipped"] = str(e)
        say("stopped: " + str(e))
    run["wall_seconds"] = round(time.time() - t_start)
    run["date"] = time.strftime("%Y-%m-%d")
    run.setdefault("source", {"url": args.url, "range_s": [args.start, args.end]})
    run["id"] = args.id
    write_json(out / "run.json", {k: v for k, v in run.items() if k not in ("recipe", "primitives")} | {"recipe_file": "recipe.json" if "recipe" in run else None})
    write_readme(out, run)
    say(f"wrote {out}")
    return 3 if run.get("skipped") else 0


def adult(args, out, work, info, run):
    import modal
    import modal_app as M
    frames_dir = work / "frames"
    n = len(list(frames_dir.glob("f*.jpg")))
    idx = np.unique(np.linspace(0, n - 1, ADULT_FRAMES).astype(int))
    raw = [(frames_dir / f"f{i:05d}.jpg").read_bytes() for i in idx]
    say(f"adult check: masking faces on Modal for {len(raw)} sample frames, then asking the vision model")
    with modal.enable_output(), M.app.run():
        r = M.Worker().mask_for_review.remote(raw, False)
    (work / "review").mkdir(exist_ok=True)
    for i, b in zip(idx, r["masked"]):
        (work / "review" / f"f{i:05d}.jpg").write_bytes(b)
    v = vision.adult_check(r["masked"], info)
    run["cost"]["adult_gpu_seconds"] = round(r["seconds"] + r["load_s"] + 30)
    run["cost"]["meta_usd"] = round(run["cost"].get("meta_usd", 0) + v["usd"], 4)
    run["adult_check"] = v
    write_json(out / "inputs/adult_check.json", v | {"frames": [int(i) for i in idx], "faces_found_per_frame": [x["faces"] for x in r["receipt"]]})


def scan(args, out, work, vdir, info, run):
    """Obstacles and moves with time ranges over the whole range: faces masked on Modal, then Meta vision on sheets of 12 frames."""
    import modal
    import modal_app as M
    from PIL import Image, ImageDraw
    fdir = work / "scan"
    fdir.mkdir(parents=True, exist_ok=True)
    for old in fdir.glob("*.jpg"):
        old.unlink()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(args.start), "-to", str(args.end), "-i", str(vdir / "source.mp4"), "-vf",
                    f"fps=1/{args.scan_step},scale='if(gte(iw,ih),640,-2)':'if(gte(iw,ih),-2,640)'", "-q:v", "3", str(fdir / "s%04d.jpg")], check=True)
    files = sorted(fdir.glob("s*.jpg"))
    say(f"scan: {len(files)} frames, faces masked on Modal first")
    with modal.enable_output(), M.app.run():
        r = M.Worker().mask_for_review.remote([f.read_bytes() for f in files], False)
    segs, usd = [], 0.0
    for s in range(0, len(files), 12):
        tiles = []
        for k, b in enumerate(r["masked"][s:s + 12]):
            import io
            im = Image.open(io.BytesIO(b)).convert("RGB").resize((320, 320 * Image.open(io.BytesIO(b)).height // Image.open(io.BytesIO(b)).width))
            ImageDraw.Draw(im).text((6, 4), f"{args.start + (s + k) * args.scan_step:.0f}s", fill=(255, 255, 0))
            tiles.append(im)
        w, h = 320, max(t.height for t in tiles)
        sheet = Image.new("RGB", (w * 4, h * ((len(tiles) + 3) // 4)))
        for k, t in enumerate(tiles):
            sheet.paste(t, ((k % 4) * w, (k // 4) * h))
        import io as _io
        buf = _io.BytesIO()
        sheet.save(buf, "JPEG", quality=85)
        res = vision.scan_sheet([buf.getvalue()], info)
        segs += res["segments"]
        usd += res["usd"]
    run["cost"].update(gpu_container_seconds=round(r["seconds"] + r["load_s"] + 30), modal_usd=round((r["seconds"] + r["load_s"] + 30) * L4_PER_SECOND, 3), meta_usd=round(usd, 4))
    write_json(out / "scan.json", {"step_s": args.scan_step, "range_s": [args.start, args.end], "segments": sorted(segs, key=lambda x: x["start_s"]),
                                   "note": "listed by a vision model from face-masked frames; time ranges are the model's reading of the labels, so check before use"})
    run["wall_seconds"] = 0
    write_json(out / "run.json", {k: v for k, v in run.items()})
    say(f"scan found {len(segs)} segments; see {out / 'scan.json'}")
    return 0


def segment(args, out, work, a, b, phrases, run):
    """SAM 3.1 on SEG_FRAMES people-blurred frames from the athlete's stretch, every phrase on every frame."""
    import sam31_park as SP
    idx = [int(i) for i in np.unique(np.linspace(a, b - 1, SEG_FRAMES).astype(int))]
    (out / "outputs/raw").mkdir(parents=True, exist_ok=True)
    proxy = start_proxy()
    try:
        jobs = [(work / "masked" / f"f{i:05d}.jpg", ph, i) for i in idx for ph in phrases]
        found, images, t0 = [], 0, time.time()
        say(f"SAM 3.1: {len(jobs)} requests (about ${len(jobs) * SAM_PER_IMAGE:.3f})")
        import concurrent.futures as cf
        with cf.ThreadPoolExecutor(4) as ex:
            res = list(ex.map(lambda j: SP.call("http://127.0.0.1:8787", str(j[0]), j[1], str(out)), jobs))
        for (path, ph, i), (r, _) in zip(jobs, res):
            if r["status"] != 200:
                continue
            raw = json.loads(r["raw"])
            images += raw.get("usage", {}).get("images_processed", 1) or 1
            text = raw["output"][0]["content"][0]["text"]
            for o in SP.parse(text, None):
                found.append({"phrase": ph, "frame": i, **o})
    finally:
        if proxy:
            proxy.kill()
    run["cost"].update(sam31_images=images, sam31_usd=round(images * SAM_PER_IMAGE, 4), sam31_seconds=round(time.time() - t0, 1))
    from PIL import Image
    return {"frames": idx, "found": found, "image_px": Image.open(jobs[0][0]).width * Image.open(jobs[0][0]).height}


def fit_objects(args, out, objs, floor_row, person_px, facing, contacts, run):
    dets, masks = [], {}
    for o in objs["found"]:
        if o.get("mask") is None:
            continue
        d = {"phrase": o["phrase"], "score": o["score"], "box": o["box"], "mask_px": o.get("mask_px"), "frames": [o["frame"]]}
        dets.append(d)
        masks[(o["phrase"], tuple(o["box"]))] = o["mask"]
    dets = P.keep_best(P.merge_detections(dets), objs["image_px"])
    merged = dets
    scale, scale_note = None, ""
    if args.known_height:
        ph, m = args.known_height.rsplit("=", 1)
        d = next((d for d in merged if d["phrase"] == ph.strip()), None)
        if d and floor_row:
            scale = P.scale_known_height(float(m), floor_row - d["box"][1], note=f"'{ph.strip()}' is {m} m high (given)")
    if scale is None and person_px:
        scale = P.scale_body_height(person_px)
    if scale is None or floor_row is None:
        run["fit_note"] = "no athlete box to take a scale or floor from: no primitives fitted"
        return [], []
    edges = {}
    for d in merged:
        mk = masks.get((d["phrase"], tuple(d["box"])))
        if mk is not None and (P.primitive_for_phrase(d["phrase"]) or (None, 0, {}))[2].get("profile") == "arc":
            arr, ox, oy = mk
            edges[(d["phrase"], tuple(d["box"]))] = edge_points(arr, ox, oy, facing)
    prims = [p for p in P.fit_all(dets, scale, floor_row, edges, args.view) if p]
    for p in prims:
        p["contactCheck"] = P.check_with_contacts(p, contacts)
    run["scale"] = scale
    overlay = [{"phrase": o["phrase"], "mask": o["mask"], "box": o["box"]} for o in objs["found"] if o["frame"] == objs["frames"][len(objs["frames"]) // 2]]
    return prims, overlay


def pick_obstacle(prims, contacts, phrase=None):
    """The primitive the move is about: the named phrase, else the biggest, best-scored ramp, wall or platform (a bar only if nothing else was found)."""
    if phrase:
        return next((p for p in prims if p["fit"]["phrase"] == phrase), None)
    for types in (("ramp", "wall", "platform"), ("bar", "ropeAnchor")):
        cand = [p for p in prims if p["type"] in types]
        if cand:
            return max(cand, key=lambda p: (p["fit"].get("maskPx") or 0) * (p["fit"].get("score") or 0))
    return None


def validate_primitives(path):
    try:
        import jsonschema
    except ImportError:
        say("jsonschema not installed: primitives.json not validated")
        return
    schema = json.loads((REPO / "course/primitives.schema.json").read_text())
    jsonschema.Draft202012Validator(schema).validate(json.loads(Path(path).read_text()))


if __name__ == "__main__":
    sys.exit(main())
