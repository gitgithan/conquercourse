"""Plausibility gate (pipeline 4): hard rules block publishing; soft rules are reported."""
import numpy as np
from joints import IDX, NAMES, PARENTS, j, speeds

G = 9.81
# Winter's segment masses and where the centre sits between two joints (from the first of the pair)
SEGMENTS = [("Neck2", "Head", 0.081, 0.5), ("Hips", "Neck1", 0.497, 0.5)]
for s in ("Left", "Right"):
    SEGMENTS += [(s + "Arm", s + "ForeArm", 0.028, 0.436), (s + "ForeArm", s + "Hand", 0.016, 0.430),
                 (s + "Hand", s + "HandMiddleEnd", 0.006, 0.506), (s + "Leg", s + "Shin", 0.100, 0.433),
                 (s + "Shin", s + "Foot", 0.0465, 0.433), (s + "Foot", s + "ToeBase", 0.0145, 0.5)]


def com(m):
    tot = sum(w for _, _, w, _ in SEGMENTS)
    c = 0
    for a, b, w, r in SEGMENTS:
        c = c + w * (j(m, a) + r * (j(m, b) - j(m, a)))
    return c / tot


def _unit(v):
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)


def knee_info(m, side):
    thigh = j(m, side + "Shin") - j(m, side + "Leg")
    shin = j(m, side + "Foot") - j(m, side + "Shin")
    a, b = _unit(thigh), _unit(shin)
    bend = np.degrees(np.arccos(np.clip((a * b).sum(-1), -1, 1)))
    hinge = _unit(np.cross(a, b))
    sideax = _unit(j(m, "LeftLeg") - j(m, "RightLeg"))
    if side == "Right":
        pass  # the hinge of both knees should point along the hips' left axis
    ang = np.degrees(np.arccos(np.clip((hinge * sideax).sum(-1), -1, 1)))
    return bend, ang


def support(m, times, floor=0.0):
    """True where the body is held: lowest joint within 15 cm of floor, or a hand/foot is still."""
    T = len(m)
    low = m[:, :, 1].min(1) - floor < 0.15
    t = np.asarray(times)
    fps = (len(t) - 1) / (t[-1] - t[0])
    need = max(2, int(round(4 * fps / 25)))
    held = np.zeros(T, bool)
    for n in ("LeftHand", "RightHand", "LeftFoot", "RightFoot"):
        v = speeds(j(m, n), t)
        lim = 1.0 if (n.endswith("Hand") and (j(m, n)[:, 1] > j(m, "Head")[:, 1]).any()) else 0.3
        if n.endswith("Hand"):
            lim = np.where(j(m, n)[:, 1] > j(m, "Head")[:, 1], 1.0, 0.3)
        still = v < lim
        run = 0
        for i in range(T):
            run = run + 1 if still[i] else 0
            if run >= need:
                held[i - need + 1:i + 1] = True
    return low | held


def longest_flight(sup):
    best, cur, bs = (0, 0), 0, 0
    for i, s in enumerate(list(~sup) + [False]):
        if s:
            if cur == 0:
                bs = i
            cur += 1
        else:
            if cur > best[1] - best[0]:
                best = (bs, bs + cur)
            cur = 0
    return best


def run_gate(m, times, floor=0.0, gravity=G, supported_by=None):
    """m: (T,30,3) metres y-up. Returns {'pass': bool, 'hard': {...}, 'soft': {...}}"""
    t = np.asarray(times)
    hard, soft = {}, {}
    # knees
    worst_back = worst_twist = 0.0
    maxbend = 0.0
    for side in ("Left", "Right"):
        bend, ang = knee_info(m, side)
        bent = bend > 15
        maxbend = max(maxbend, float(bend.max()))
        if bent.any():
            worst_back = max(worst_back, float(ang[bent].max()))
            worst_twist = max(worst_twist, float(ang[bent].max()))
    hard["knees_bend_forward"] = {"ok": worst_back < 120, "worst_axis_angle_deg": worst_back}
    hard["legs_not_twisted"] = {"ok": worst_twist <= 60, "worst_deg": worst_twist}
    hard["knee_range"] = {"ok": maxbend <= 165, "max_bend_deg": maxbend}
    # flight
    c = com(m)
    sup = support(m, t, floor)
    a, b = longest_flight(sup)
    fl = {"frames": [int(a), int(b)], "seconds": float(t[b - 1] - t[a]) if b - a > 1 else 0.0}
    if supported_by:
        fl.update(ok=True, note="supported by " + supported_by)
    elif fl["seconds"] < 0.3:
        fl.update(ok=True, note="no unsupported stretch long enough to judge", judged=False)
    else:
        tt = t[a:b] - t[a]
        coef = np.polyfit(tt, c[a:b, 1], 2)
        g = -2 * coef[0]
        err = abs(g - gravity) / gravity
        fl.update(ok=bool(err <= 0.15), fitted_g=float(g), rel_err=float(err), judged=True)
    hard["flight_ballistic"] = fl
    # floor, teleport
    sink = float(floor - m[:, :, [IDX["LeftFoot"], IDX["RightFoot"], IDX["LeftToeBase"], IDX["RightToeBase"]]][:, 1].min()) if False else float(floor - m[:, [IDX[n] for n in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")], 1].min())
    hard["feet_dont_sink"] = {"ok": sink <= 0.03, "sink_m": max(0.0, sink)}
    hv = float(speeds(j(m, "Hips"), t).max())
    hard["no_teleport"] = {"ok": hv <= 12, "max_hip_speed_mps": hv}
    # soft
    lens = {}
    worst = 0.0
    for i, p in enumerate(PARENTS):
        if p >= 0:
            d = np.linalg.norm(m[:, i] - m[:, p], axis=1)
            worst = max(worst, float(np.abs(d / np.median(d) - 1).max()))
    soft["bone_length_dev"] = {"ok": worst <= 0.02, "worst": worst}
    acc = np.gradient(np.gradient(m, t, axis=0), t, axis=0)
    soft["max_accel_mps2"] = {"ok": float(np.linalg.norm(acc, axis=2).max()) <= 200, "value": float(np.linalg.norm(acc, axis=2).max())}
    return {"pass": all(v["ok"] for v in hard.values()), "hard": hard, "soft": soft}


# ---- the only repairs allowed ----
def lift_to_floor(m, floor=0.0):
    m = m.copy()
    low = m[:, :, 1].min(1)
    m[:, :, 1] += np.maximum(0, floor - low)[:, None]
    return m


def fix_knees(m):
    """Mirror a backwards knee across the hip-ankle line; hip and ankle stay, bone lengths stay."""
    m = m.copy()
    for side in ("Left", "Right"):
        bend, ang = knee_info(m, side)
        for f in np.where((bend > 15) & (ang > 120))[0]:
            h, k, a = m[f, IDX[side + "Leg"]], m[f, IDX[side + "Shin"]], m[f, IDX[side + "Foot"]]
            ax = _unit(a - h)
            rel = k - h
            proj = (rel @ ax) * ax
            m[f, IDX[side + "Shin"]] = h + proj - (rel - proj)
    return m
