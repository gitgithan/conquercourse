"""CPU half of video to motion: SOMA joints -> 30 joints in the world, contacts, repairs, gate, contact sheet.

Usage: python post.py CLIP_STEM
"""
import json
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from joints import IDX, NAMES, j, speeds  # also puts pipelines/ on the path for ccpipe
from ccpipe import gate as G, repairs  # noqa: E402

WORK = Path(os.environ.get("CC_ASSETS_DIR", Path(__file__).resolve().parents[3] / "conquercourse-assets")) / "work"
EVAL = Path(os.environ.get("CC_EVAL_DIR", Path(__file__).resolve().parents[2] / "data/eval/cc-26-pexels-motion"))
# moves held by equipment carry supportedBy (pipeline 2); a free-flight rule is not applied to them
SUPPORTED_BY = {"Monkey_bars_hang_and_swing": "playground bars", "Over_a_brick_wall_vault_or_wall_move": "a brick wall"}
GROUND_UP = 0.25   # a contact higher than this above the floor touches an obstacle


def smooth_line(x, t, win):
    """moving straight-line fit over `win` frames (the noisy depth axis)"""
    out = np.empty_like(x)
    h = win // 2
    for i in range(len(x)):
        a, b = max(0, i - h), min(len(x), i + h + 1)
        c = np.polyfit(t[a:b], x[a:b], 1) if b - a > 2 else [0, x[i]]
        out[i] = np.polyval(c, t[i])
    return out


def athlete_segment(measured, frac=0.35, gap=3):
    """longest run of frames where the person box is at least `frac` of the typical box height (a far
    bystander or an empty scene is not the athlete); small gaps are bridged"""
    h = np.array([(m["bbox"][3] - m["bbox"][1]) if m["ok"] else 0 for m in measured], float)
    big = h >= frac * np.percentile(h[h > 0], 90)
    best, i = (0, 0), 0
    while i < len(big):
        if big[i]:
            k = i
            while True:
                nxt = next((q for q in range(k + 1, min(len(big), k + 2 + gap)) if big[q]), None)
                if nxt is None:
                    break
                k = nxt
            if k - i > best[1] - best[0]:
                best = (i, k)
            i = k + 1
        else:
            i += 1
    return best[0], best[1] + 1


def build(stem, frac=0.35):
    times = json.loads((WORK / stem / "frames/times.json").read_text())
    measured = json.loads((WORK / stem / "measured.json").read_text())
    soma = json.loads((WORK / stem / "soma.json").read_text())
    names = [n for n in soma["joint_names"] if "Twist" not in n and n != "Root"]   # public joints, no world root
    J = np.array(soma["joints_cm"]) / 100.0           # (N,77,3) metres, body-model frame (y up)
    assert len(names) == J.shape[1], (len(names), J.shape)
    sel = [names.index(n) for n in NAMES]
    ok = [i for i, m in enumerate(measured) if m["ok"]]
    t_all = np.array(times["times"])
    T = len(measured)
    flip = np.array([1, -1, -1])                      # camera (x right, y down, z away) -> world (x, y up, z toward camera)
    body = np.full((T, 30, 3), np.nan)
    pelvis = np.full((T, 3), np.nan)
    check = []
    for k, i in enumerate(ok):
        m = measured[i]
        jj = J[k][sel]
        kp = np.array(m["kp3d"]) * flip
        pel_w = (kp[9] + kp[10]) / 2 + np.array(m["cam_t"]) * flip      # where the pelvis is in the world
        body[i] = jj - jj[IDX["Hips"]]
        pelvis[i] = pel_w
        side_model = jj[IDX["LeftLeg"]] - jj[IDX["RightLeg"]]
        side_kp = kp[9] - kp[10]
        check.append(float(side_model @ side_kp / (np.linalg.norm(side_model) * np.linalg.norm(side_kp) + 1e-9)))
    seg = athlete_segment(measured, frac=frac)
    a, b = seg
    # frames in the segment whose depth jumps from its neighbours are another person or a bad fit: drop and bridge
    z = pelvis[:, 2].copy()
    bad = np.zeros(T, bool)
    for i in range(a, b):
        lo, hi = max(a, i - 3), min(b, i + 4)
        nb = z[lo:hi][~np.isnan(z[lo:hi])]
        if len(nb) >= 3 and abs(z[i] - np.median(nb)) > 0.6:
            bad[i] = True
    if bad[a:b].any():
        body[bad] = np.nan
        pelvis[bad] = np.nan
    for arr in (body.reshape(T, -1), pelvis):
        for c in range(arr.shape[1]):
            v = arr[:, c]
            m = np.isnan(v)
            gd = ~m
            gd[:a] = gd[b:] = False
            if m[a:b].any() and gd.any():
                v[m] = np.interp(t_all[m], t_all[gd], v[gd])
    pelvis[a:b, 2] = smooth_line(pelvis[a:b, 2], t_all[a:b], 9)
    pelvis[a:b, 0] = smooth_line(pelvis[a:b, 0], t_all[a:b], 3)
    world = body + pelvis[:, None, :]
    return times, world, ok, seg, {"side_axis_agreement_cos_mean": float(np.mean(check)), "bridged_frames": [int(i) for i in np.where(bad)[0]]}


def smooth_joints(w):
    """light 1-2-3-2-1 smoothing in time (per-frame measurement jitter), ends padded by repetition"""
    k = np.array([1, 2, 3, 2, 1], float)
    k /= k.sum()
    pad = np.concatenate([w[:2][::-1] * 0 + w[:1], w, w[-2:][::-1] * 0 + w[-1:]])
    return sum(k[i] * pad[i:i + len(w)] for i in range(5))


def fixed_skeleton(w):
    """one body for the whole clip: every bone gets its median length, keeping each frame's bone directions"""
    from joints import PARENTS
    out = w.copy()
    med = {i: np.median(np.linalg.norm(w[:, i] - w[:, p], axis=1)) for i, p in enumerate(PARENTS) if p >= 0}
    for i, p in enumerate(PARENTS):   # parents come before children in NAMES order
        if p < 0:
            continue
        d = w[:, i] - w[:, p]
        d = d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-9)
        out[:, i] = out[:, p] + d * med[i]
    return out


def level_floor(w, t):
    """floor from the feet's lowest points on frames where a foot is nearly still: a plane y = a + b*z + c*x
    (a level camera still shows a tilt from depth error); constant when the points span under 0.5 m of depth"""
    fj = [IDX[n] for n in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")]
    low = w[:, fj, 1].min(1)
    sp = np.minimum(speeds(j(w, "LeftFoot"), t), speeds(j(w, "RightFoot"), t))
    cand = (sp < 0.5) & (low < np.percentile(low, 5) + 0.3)
    if cand.sum() < 3:
        cand = low < np.percentile(low, 10)
    hips = j(w, "Hips")
    X = np.c_[np.ones(len(w)), hips[:, 2], hips[:, 0]]
    use = cand.copy()
    span = np.ptp(hips[cand, 2]) if cand.any() else 0
    cols = [0, 1, 2] if span >= 0.5 else [0]
    for _ in range(3):
        coef, *_ = np.linalg.lstsq(X[use][:, cols], low[use], rcond=None)
        res = low - X[:, cols] @ coef
        use = cand & (res < np.percentile(res[cand], 80))
    plane = X[:, cols] @ coef
    w = w.copy()
    w[:, :, 1] -= plane[:, None]
    return w, {"floor_fit_terms": ["const", "depth", "x"][:len(cols)] if span >= 0.5 else ["const"],
               "floor_points": int(cand.sum()), "floor_offset_m": float(coef[0])}


def orient_and_level(world, t):
    """Turn so travel (or, standing still, the way the chest faces) is +z; floor from the feet's lowest points."""
    hips = j(world, "Hips")
    trav = hips[-1] - hips[0]
    trav[1] = 0
    if np.linalg.norm(trav) < 0.5:
        left = j(world, "LeftLeg") - j(world, "RightLeg")
        left[:, 1] = 0
        left = left.mean(0)
        fwd = np.cross(left, [0, 1, 0])
        how = "facing"
    else:
        fwd, how = trav, "travel"
    fwd = fwd / np.linalg.norm(fwd)
    ang = np.arctan2(fwd[0], fwd[2])      # rotate about y so fwd -> +z
    c, s = np.cos(ang), np.sin(ang)
    R = np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])
    w = world @ R.T
    w = fixed_skeleton(smooth_joints(w))
    w, floor_info = level_floor(w, t)
    # character's left must be +x
    left = (j(w, "LeftLeg") - j(w, "RightLeg"))[:, 0].mean()
    if left < 0:   # mirrored (should not happen with proper rotation); report rather than hide
        how += " (left on -x: mirrored)"
    hips = j(w, "Hips")
    hips_xz = hips[:, [0, 2]]
    w[:, :, 0] -= hips_xz[0, 0]
    w[:, :, 2] -= hips_xz[0, 1]
    return w, dict({"orientation_from": how}, **floor_info)


def contacts(m, t):
    fps = (len(t) - 1) / (t[-1] - t[0])
    out = []
    hips_y = j(m, "Hips")[:, 1]
    for name in ("LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        p = j(m, name)
        v = speeds(p, t)
        hand = name.endswith("Hand")
        base = max(3, int(np.ceil(3 * fps / 25)))
        need = np.where(hand & (p[:, 1] > hips_y + 0.3), base, base + int(np.ceil(fps / 25))) if hand else np.full(len(p), base)
        still = v < 1.0
        i = 0
        while i < len(p):
            if still[i]:
                k = i
                while k + 1 < len(p) and still[k + 1]:
                    k += 1
                if k - i + 1 >= need[i]:
                    pt = p[i:k + 1].mean(0)
                    out.append({"joint": name, "frames": [i, k], "t": [float(t[i]), float(t[k])],
                                "point": [round(float(x), 3) for x in pt],
                                "kind": "obstacle" if pt[1] > GROUND_UP else "ground"})
                i = k + 1
            else:
                i += 1
    # brief plants: foot above knee height, out to the side of the hips, at its own speed minimum
    for name, kn in (("LeftFoot", "LeftShin"), ("RightFoot", "RightShin")):
        p = j(m, name)
        v = speeds(p, t)
        side = np.abs(p[:, 0] - j(m, "Hips")[:, 0])
        for i in range(1, len(p) - 1):
            if v[i] < v[i - 1] and v[i] <= v[i + 1] and p[i, 1] > j(m, kn)[i, 1] and side[i] > 0.25:
                if not any(c["joint"] == name and c["frames"][0] <= i <= c["frames"][1] for c in out):
                    out.append({"joint": name, "frames": [i, i], "t": [float(t[i])] * 2,
                                "point": [round(float(x), 3) for x in p[i]], "kind": "obstacle", "brief_plant": True})
    out.sort(key=lambda c: c["frames"][0])
    return out


def boxes_from(cs):
    """each off-ground contact implies a surface: a small axis-aligned slab whose top is the contact point (less 6 cm)"""
    bs = []
    for c in cs:
        if c["kind"] != "obstacle":
            continue
        x, y, z = c["point"]
        top = y - 0.06
        bs.append({"min": [x - 0.25, max(0.0, top - 0.05), z - 0.25], "max": [x + 0.25, top, z + 0.25],
                   "from": c["joint"], "implied": True})
    return bs


def sheet(stem, a, b, out_png, n=8):
    import cv2
    meas = json.loads((WORK / stem / "measured.json").read_text())
    idxs = np.linspace(a, b - 1, n).astype(int)
    t = json.loads((WORK / stem / "frames/times.json").read_text())["times"]
    tiles = []
    for i in idxs:
        im = cv2.imread(str(WORK / stem / "masked" / f"f{i:05d}.jpg"))
        m = meas[i]
        if m["ok"]:
            for x, y in np.array(m["kp2d"])[:, :2]:
                cv2.circle(im, (int(x), int(y)), 5, (0, 255, 255), -1)
        cv2.putText(im, f"t={t[i]:.2f}s", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 4)
        tiles.append(cv2.resize(im, (480, int(480 * im.shape[0] / im.shape[1]))))
    rows = [np.hstack(tiles[r:r + 4]) for r in range(0, n, 4)]
    cv2.imwrite(str(out_png), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])


def repair_frames(w, t, supported_by=None):
    """The allowed repairs (knee mirror, lift to the floor) on (T,30,3) metres; returns the new frames."""
    clip = G.clip_from_times(w, t, supportedBy=supported_by) if supported_by else G.clip_from_times(w, t)
    clip, _ = repairs.fix_knees(clip)
    clip, _ = repairs.lift_to_floor(clip)
    return clip.frames


def main(stem, supported_by=None, eval_dir=None, frac=0.35):
    out = Path(eval_dir or EVAL) / stem
    times, world, ok, (a, b), diag = build(stem, frac)
    world = world[a:b]
    t = np.array(times["times"])[a:b]
    times = dict(times, times=list(t), n=b - a, n_total=times["n"])
    ok = [i - a for i in ok if a <= i < b]
    w, info = orient_and_level(world, t)
    sup = supported_by or SUPPORTED_BY.get(stem)
    free_flight = G.run_gate_times(w, t)          # the rule as written, with no supportedBy
    raw_gate = G.run_gate_times(w, t, supported_by=sup)
    rep = repair_frames(w, t, sup)
    rep_gate = G.run_gate_times(rep, t, supported_by=sup)
    final, verdict_on = (rep, "repaired") if rep_gate["pass"] or not raw_gate["pass"] else (w, "raw")
    cs = contacts(final, t)
    motion = {"names": NAMES, "fps": times["fps"], "first_frame": int(a), "times": [round(float(x), 5) for x in t],
              "frames": np.round(final, 4).tolist(), "gravity": 9.81, "geometry": boxes_from(cs)}
    assert all(len(f) == len(NAMES) for f in motion["frames"])
    (out / "motion.json").write_text(json.dumps(motion))
    (out / "contacts.json").write_text(json.dumps(cs, indent=1))
    (out / "gate.json").write_text(json.dumps({"raw": raw_gate, "repaired": rep_gate, "shown_version": verdict_on, "supportedBy": sup, "free_flight_rule_without_supportedBy": free_flight["hard"]["flight_is_ballistic"],
                                                "athlete_frames": [int(a), int(b)],
                                                "verdict": "PASS" if (rep_gate["pass"] or raw_gate["pass"]) else "FAIL",
                                                "world": dict(info, **diag), "athlete_frames": [a, b], "frames_in_clip": times["n_total"], "frames_unmeasured_in_segment": len(t) - len(ok)}, indent=1,
                                               default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o)))
    sheet(stem, a, b, out / "contact_sheet.jpg")
    print(stem, "gate raw", raw_gate["pass"], "repaired", rep_gate["pass"], "contacts", len(cs),
          {k: v["ok"] for k, v in rep_gate["hard"].items()})


if __name__ == "__main__":
    main(sys.argv[1])
