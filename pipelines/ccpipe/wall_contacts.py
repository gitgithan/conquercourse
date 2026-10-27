"""Pushing a generated body out of the wall and putting its hands and feet on their targets (CC-17).

docs/pipelines.md pipeline 5 (contact IK) and the push-out of pipeline 3, for a curved wall (ccpipe.wall_geom.Wall).
Order matters: repairs first, push-out, then IK last (repairs after IK once moved a wall foot 32 cm)."""
import numpy as np

from . import motion
from .motion import unit
from .skeleton import IDX, NAMES, PARENTS

CHAINS = {  # end joint -> (root, mid, end, joints that ride rigidly with the end)
    "LeftFoot": ("LeftLeg", "LeftShin", "LeftFoot", ["LeftToeBase"]),
    "RightFoot": ("RightLeg", "RightShin", "RightFoot", ["RightToeBase"]),
    "LeftHand": ("LeftArm", "LeftForeArm", "LeftHand", ["LeftHandThumbEnd", "LeftHandMiddleEnd"]),
    "RightHand": ("RightArm", "RightForeArm", "RightHand", ["RightHandThumbEnd", "RightHandMiddleEnd"]),
}
BLEND = 4  # frames either side over which a target eases in and out


def median_lengths(frames):
    return np.median(np.linalg.norm(frames[:, 1:] - frames[:, [PARENTS[i] for i in range(1, len(NAMES))]], axis=-1), axis=0)


def _bone_samples(f, parents):
    """Points 25 %, 50 % and 75 % along each bone, per frame: (T, n_bones * 3, 3)."""
    out = []
    for i in range(1, f.shape[1]):
        a, b = f[:, parents[i]], f[:, i]
        out += [a + (b - a) * k for k in (0.25, 0.5, 0.75)]
    return np.stack(out, axis=1)


def inside_wall(frames, wall):
    """Deepest a joint or a bone sample is inside the wall, per frame (m, 0 when clear)."""
    pts = np.concatenate([frames, _bone_samples(frames, PARENTS)], axis=1)
    return np.maximum(-wall.sdf(pts).min(axis=1), 0.0)


def push_out(frames, wall, margin=0.02, rounds=4):
    """Keep every joint and bone sample at least `margin` from the wall, top-down through the skeleton.

    A child follows its parent's move; one that is still too close is turned about its parent (bone length kept) along the wall's normal."""
    f = frames.copy()
    for _ in range(rounds):
        moved = False
        for t in range(len(f)):
            orig = f[t].copy()
            for j in range(1, f.shape[1]):
                p = PARENTS[j]
                length = np.linalg.norm(orig[j] - orig[p])
                pos = f[t, p] + (orig[j] - orig[p])
                for k in (1.0, 0.75, 0.5, 0.25):  # the joint itself, then the bone's samples, nearest the child first
                    pt = f[t, p] + (pos - f[t, p]) * k
                    d = float(wall.sdf(pt))
                    if d < margin - 1e-4:
                        pos = pos + wall.normal(pt) * (margin - d) / k
                        pos = f[t, p] + unit(pos - f[t, p]) * length
                        moved = True
                f[t, j] = pos
        if not moved:
            break
    return f


def weights(n, a, b, blend=BLEND):
    """1 on frames a..b, easing to 0 over `blend` frames either side."""
    w = np.zeros(n)
    for t in range(n):
        d = 0 if a <= t <= b else (a - t if t < a else t - b)
        w[t] = max(0.0, 1.0 - d / (blend + 1.0))
    return w


def two_bone(root, mid, end, target, l1, l2):
    """New mid and end with the root fixed, bone lengths l1 and l2 kept, the knee/elbow on its current bend plane.

    A target out of reach is reached at full stretch toward it; the leftover distance is returned."""
    d = target - root
    dist = np.linalg.norm(d)
    far = min(max(dist, abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6)
    dh = unit(d)
    new_end = root + dh * far
    pole = (mid - root) - dh * np.dot(mid - root, dh)
    if np.linalg.norm(pole) < 1e-6:
        pole = (mid - end) - dh * np.dot(mid - end, dh)
    pole = unit(pole)
    along = (l1 ** 2 - l2 ** 2 + far ** 2) / (2 * far)
    h = np.sqrt(max(l1 ** 2 - along ** 2, 0.0))
    return root + dh * along + pole * h, new_end, float(max(dist - far, 0.0))


def contact_ik(frames, pins):
    """pins: [{joint, frames: [first, last], point}]; returns the frames and the leftover distance of each pin at its first..last frames."""
    f = frames.copy()
    lens = median_lengths(frames)
    n = len(f)
    left = []
    for pin in pins:
        r, m, e, riders = CHAINS[pin["joint"]]
        ri, mi, ei = IDX[r], IDX[m], IDX[e]
        l1, l2 = lens[mi - 1], lens[ei - 1]
        a, b = pin["frames"]
        w = weights(n, a, b)
        tgt = np.array(pin["point"], float)
        worst = 0.0
        for t in np.where(w > 0)[0]:
            goal = f[t, ei] + (tgt - f[t, ei]) * w[t]
            new_mid, new_end, short = two_bone(f[t, ri], f[t, mi], f[t, ei], goal, l1, l2)
            delta = new_end - f[t, ei]
            for q in riders:
                f[t, IDX[q]] += delta
            f[t, mi], f[t, ei] = new_mid, new_end
            if a <= t <= b:
                worst = max(worst, float(np.linalg.norm(f[t, ei] - tgt)))
        left.append(round(worst, 4))
    return f, left


def pins_of(targets):
    return list(targets["plants"]) + list(targets["grips"]) + list(targets["deck"])


def _longest_run(mask):
    runs = motion._runs(mask)
    return max(((b - a) for a, b in runs), default=0)


def evaluate(frames, fps, targets, wall, gate_report):
    """The eight pass lines of data/eval/cc-17-wall/README.md, with the numbers behind each."""
    f = np.asarray(frames)
    n = len(f)
    hips_err = np.linalg.norm(f[:, 0] - np.array(targets["sim_hips"]), axis=1)
    grab = targets["grab_frame"]
    grips = {g["joint"]: np.array(g["point"]) for g in targets["grips"]}
    # the grab point of the pass line is the contact target itself (the top edge moved 3 cm toward the player and 2 cm down)
    wrist_err = {j: float(np.linalg.norm(f[grab, IDX[j]] - p)) for j, p in grips.items()}
    near = np.ones(n, bool)
    for j, p in grips.items():
        near &= np.linalg.norm(f[:, IDX[j]] - p, axis=1) <= 0.08
    feet = [IDX[k] for k in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")]
    deck_y = wall.h
    touching = np.zeros(n, bool)
    for j in feet:
        y, z = f[:, j, 1], f[:, j, 2]
        touching |= (y < 0.03) | ((z >= wall.r) & (np.abs(y - deck_y) < 0.03))
    hang = 0
    for a, b in motion._runs(near):
        hang = max(hang, _longest_run(~touching[a:b]))
    sp = motion.speeds(f, fps)
    plant_best = None
    for k in ("LeftFoot", "RightFoot"):
        j = IDX[k]
        still = np.zeros(n, bool)
        for a, b in motion._runs(sp[:, j] < 0.3):
            if b - a >= 4:
                still[a:b] = True
        sd = wall.sdf(f[:, j])
        ok = still & (sd >= 0.05) & (sd <= 0.12) & (f[:, j, 1] >= 0.4) & (np.arange(n) <= grab)
        if ok.any() and (plant_best is None or ok.sum() > plant_best[1]):
            plant_best = (k, int(ok.sum()), float(f[ok, j, 1].max()))
    last = slice(n - 5, n)
    above = float(f[last, 0, 1].min() - wall.h)
    dz = float(np.abs(f[last, 0, 2] - wall.r).max())
    foot_dev = float(max(np.abs(f[last, IDX[k], 1] - (wall.h + 0.08)).max() for k in ("LeftFoot", "RightFoot")))
    pen = float(inside_wall(f, wall).max())
    lines = {
        "1_gate": {"ok": bool(gate_report["pass"]), "value": [k for k, r in gate_report["hard"].items() if not r["ok"]], "limit": "all hard rules"},
        "2_hips_on_path": {"ok": bool(hips_err.max() <= 0.05), "value": round(float(hips_err.max()), 4), "limit": "<= 0.05 m on every frame"},
        "3_grab": {"ok": bool(max(wrist_err.values()) <= 0.05), "value": {k: round(v, 4) for k, v in wrist_err.items()}, "limit": "<= 0.05 m at the grab frame"},
        "4_hang": {"ok": bool(hang >= 9), "value": int(hang), "limit": ">= 9 frames within 8 cm, no foot on the ground or deck"},
        "5_plant": {"ok": plant_best is not None, "value": plant_best, "limit": "a foot still >= 4 frames, ankle 5-12 cm off the curve, >= 0.4 m up, before the grab"},
        "6_pull_up": {"ok": bool(above >= 0.8 and dz <= 0.5 and foot_dev <= 0.10), "value": {"hips_above_deck": round(above, 3), "hips_dz": round(dz, 3), "feet_off_deck_height": round(foot_dev, 3)},
                      "limit": "hips >= 0.8 m above deck, within 0.5 m of the edge, feet within 10 cm of deck height"},
        "7_wall": {"ok": bool(pen <= 0.02), "value": round(pen, 4), "limit": "<= 0.02 m inside"},
        "8_shape": {"ok": bool(n == 90 and f.shape[1] == 30), "value": [n, f.shape[1]], "limit": "90 frames, 30 joints"},
    }
    return {"met": sum(v["ok"] for v in lines.values()), "of": len(lines), "all": all(v["ok"] for v in lines.values()), "lines": lines}
