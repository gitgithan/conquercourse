"""The wall climb in two short clips, and the join (CC-36).

Stage A is the run-up: the sprint, the curve up to 2.23 m, a foot planted on it, the arms starting to rise (world coordinates).
Stage B is the hang and pull-up: hanging by both hands from the ledge, up onto the deck (a frame local to the ledge, so its rise is small).
Both stay under the 2.5 m of rise Kimodo can follow (docs/lessons.md); coordinates are the clip file's (y up, run along +z, left on +x)."""
import numpy as np

from . import motion
from .skeleton import IDX, NAMES, PARENTS
from .wall_contacts import inside_wall
from .wall_geom import ENTRY_FRAME, FOOT_SPACING, HAND_SPACING, HIP_HEIGHT, HIPS_DROP, TICKS_PER_FRAME, WRIST_OFFSET, Wall, find_plant, _frame_path

FPS = 30
A_FRAMES = 60
A_PLANTS = [("RightFoot", 40, 44), ("LeftFoot", 51, 55)]
A_ARMS = (55, 59)               # the wrists are aimed at the ledge from here to the end
A_ARM_REACH = 1.0               # hips to wrist at the end (the arm is 1.07 m at full stretch)
PROMPT_A = "A person sprints at a curved wall, steps onto it and runs up it, one foot planted on the curve, both arms starting to rise toward the top edge."

B_FRAMES = 48
B_HOLD = 14                     # frames 0-13: hanging
B_MANTLE = 18                   # 72 ticks at 120 Hz (src/sim/world.ts, MANTLE_TICKS)
B_GRIP_LAST = 20                # the wrists stay on the ledge until here
B_DECK_FIRST = 38               # the ankles are on the deck from here to the end
B_SHIFT_Y = 2.2                 # world y = local y + this (the ledge is 2.1 m up in the local frame, so the hang is near the model's floor)
B_HANG_DROP = 1.0               # hips under the ledge while hanging (the arm reaches 1.07 m)
B_HANG_Z = -0.25                # hips before the edge while hanging
B_MANTLE_RUN = 0.4              # the simulator's MANTLE_RUN: the feet end this far past the edge
PROMPT_B = "A person hangs from a ledge by both hands with the feet off the ground, then pulls up with both arms and stands on top of the ledge."

BLEND = 10                      # frames between the end of A and the start of B


def _smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


def build_targets_a(sim, wall=None):
    """Kimodo targets for the run-up (stage A) from the exported simulator wall run."""
    wall = wall or Wall(sim["params"]["height"], sim["params"].get("radius"))
    speed = sim["entrySpeed"]
    feet = np.zeros((A_FRAMES, 2))              # (z, y)
    for f in range(A_FRAMES):
        feet[f] = (-speed * (ENTRY_FRAME - f) / FPS, 0.0) if f < ENTRY_FRAME else _frame_path(sim["apexPath"], (f - ENTRY_FRAME) * TICKS_PER_FRAME)
    sim_hips = np.stack([np.zeros(A_FRAMES), feet[:, 1] + HIP_HEIGHT, feet[:, 0]], axis=1)
    hips = sim_hips - [0, HIPS_DROP, 0]
    plants = [find_plant(wall, hips, foot, a, b) for foot, a, b in A_PLANTS]
    edge_wrist = np.array([0.0, wall.h + WRIST_OFFSET[1], wall.r + WRIST_OFFSET[0]])
    d = edge_wrist - sim_hips[-1]
    reach_pt = sim_hips[-1] + d / np.linalg.norm(d) * A_ARM_REACH
    grips = [{"joint": j, "frames": list(A_ARMS), "point": (reach_pt + [sx * HAND_SPACING / 2, 0, 0]).round(4).tolist()}
             for j, sx in (("LeftHand", 1), ("RightHand", -1))]
    return {"stage": "a", "prompt": PROMPT_A, "fps": FPS, "frames": A_FRAMES, "entry_frame": ENTRY_FRAME,
            "sim_hips": sim_hips.round(4).tolist(), "hips": hips.round(4).tolist(),
            "plants": plants, "grips": grips, "deck": [],
            "hips_to_edge_wrist_at_end": round(float(np.linalg.norm(d)), 3),
            "hips_rise": round(float(sim_hips[:, 1].max() - sim_hips[:, 1].min()), 3)}


def build_targets_b(wall=None):
    """Kimodo targets for the hang and pull-up (stage B) in the ledge's local frame (edge at z = 0, ledge at y = h - B_SHIFT_Y).

    `world_shift` turns local into world (add it); `sim_hips` is the intended hips path in world coordinates (for pictures)."""
    wall = wall or Wall()
    shift = np.array([0.0, B_SHIFT_Y, wall.r])
    ledge = wall.h - B_SHIFT_Y
    hang = np.array([0.0, ledge - B_HANG_DROP, B_HANG_Z])
    end = np.array([0.0, ledge + HIP_HEIGHT, B_MANTLE_RUN])
    hips = np.zeros((B_FRAMES, 3))
    for f in range(B_FRAMES):
        u = (f - B_HOLD) / (B_MANTLE - 1)
        y, z = _smooth(u), _smooth((u - 0.35) / 0.65)       # up first, over the edge later
        hips[f] = hang + (end - hang) * np.array([0.0, y, z])
    wrist = [{"joint": j, "frames": [0, B_GRIP_LAST], "point": [sx * HAND_SPACING / 2, ledge + WRIST_OFFSET[1], WRIST_OFFSET[0]]}
             for j, sx in (("LeftHand", 1), ("RightHand", -1))]
    deck = [{"joint": j, "frames": [B_DECK_FIRST, B_FRAMES - 1], "point": [sx * FOOT_SPACING, ledge + 0.08, B_MANTLE_RUN]}
            for j, sx in (("LeftFoot", 1), ("RightFoot", -1))]
    return {"stage": "b", "prompt": PROMPT_B, "fps": FPS, "frames": B_FRAMES, "world_shift": shift.tolist(),
            "hips": hips.round(4).tolist(), "sim_hips": (hips + shift).round(4).tolist(),
            "plants": [], "grips": wrist, "deck": deck,
            "hips_rise": round(float(hips[:, 1].max() - hips[:, 1].min()), 3),
            "hips_to_wrist_at_hang": round(float(np.linalg.norm(hips[0] - np.array([0.0, ledge + WRIST_OFFSET[1], WRIST_OFFSET[0]]))), 3)}


def world_targets_b(tb):
    """Stage B's targets with every point moved from the local frame into the world."""
    s = np.array(tb["world_shift"])
    out = dict(tb)
    out["hips"] = (np.array(tb["hips"]) + s).round(4).tolist()
    for k in ("plants", "grips", "deck"):
        out[k] = [{**p, "point": (np.array(p["point"]) + s).round(4).tolist()} for p in tb[k]]
    return out


def _plant_best(f, wall, upto):
    sp = motion.speeds(f, FPS)
    best = None
    for k in ("LeftFoot", "RightFoot"):
        j = IDX[k]
        still = np.zeros(len(f), bool)
        for a, b in motion._runs(sp[:, j] < 0.3):
            if b - a >= 4:
                still[a:b] = True
        sd = wall.sdf(f[:, j])
        ok = still & (sd >= 0.05) & (sd <= 0.12) & (f[:, j, 1] >= 0.4) & (np.arange(len(f)) <= upto)
        if ok.any() and (best is None or ok.sum() > best[1]):
            best = (k, int(ok.sum()), round(float(f[ok, j, 1].max()), 3))
    return best


def _gate_line(report):
    return {"ok": bool(report["pass"]), "value": [k for k, r in report["hard"].items() if not r["ok"]], "limit": "all hard rules"}


def _summary(lines):
    return {"met": sum(v["ok"] for v in lines.values()), "of": len(lines), "all": all(v["ok"] for v in lines.values()), "lines": lines}


def evaluate_a(frames, targets, wall, gate_report):
    """The six pass lines of stage A (data/eval/cc-36-wall-two-stage/README.md); frames in world coordinates."""
    f = np.asarray(frames)
    err = np.linalg.norm(f[:, 0] - np.array(targets["sim_hips"]), axis=1)
    plant = _plant_best(f, wall, len(f))
    over = {s: float((f[-1, IDX[f"{s}Hand"], 1] - f[-1, IDX[f"{s}Shoulder"], 1])) for s in ("Left", "Right")}
    pen = float(inside_wall(f, wall).max())
    return _summary({
        "1_gate": _gate_line(gate_report),
        "2_hips_on_path": {"ok": bool(err.max() <= 0.05), "value": round(float(err.max()), 4), "limit": "<= 0.05 m on every frame"},
        "3_plant": {"ok": plant is not None, "value": plant, "limit": "a foot still >= 4 frames, ankle 5-12 cm off the curve, >= 0.4 m up"},
        "4_arms_rising": {"ok": bool(min(over.values()) > 0), "value": {k: round(v, 3) for k, v in over.items()}, "limit": "both wrists above their shoulders on the last frame"},
        "5_wall": {"ok": bool(pen <= 0.02), "value": round(pen, 4), "limit": "<= 0.02 m inside"},
        "6_shape": {"ok": bool(len(f) == A_FRAMES and f.shape[1] == 30), "value": [len(f), f.shape[1]], "limit": f"{A_FRAMES} frames, 30 joints"},
    })


def evaluate_b(frames, targets_world, wall, gate_report):
    """The six pass lines of stage B; frames and targets in world coordinates."""
    f = np.asarray(frames)
    n = len(f)
    grips = {g["joint"]: np.array(g["point"]) for g in targets_world["grips"]}
    near = np.ones(n, bool)
    wrist_err = {}
    for j, p in grips.items():
        d = np.linalg.norm(f[:, IDX[j]] - p, axis=1)
        near &= d <= 0.05
        wrist_err[j] = round(float(d[: B_GRIP_LAST + 1].min()), 3)
    touching = np.zeros(n, bool)
    for j in [IDX[k] for k in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")]:
        y, z = f[:, j, 1], f[:, j, 2]
        touching |= (y < 0.03) | ((z >= wall.r) & (np.abs(y - wall.h) < 0.03))
    hang, hang_end = 0, 0
    for a, b in motion._runs(near & ~touching):
        if b - a > hang:
            hang, hang_end = b - a, b
    last = slice(n - 5, n)
    above = float(f[last, 0, 1].min() - wall.h)
    feet = ("LeftFoot", "RightFoot")
    foot_dev = float(max(np.abs(f[last, IDX[k], 1] - (wall.h + 0.08)).max() for k in feet))
    foot_z = float(min(f[last, IDX[k], 2].min() for k in feet))
    pull = bool(hang >= 9 and hang_end <= n - 5 and above >= 0.8 and foot_dev <= 0.10 and foot_z >= wall.r)
    pen = float(inside_wall(f, wall).max())
    rise = float(f[:, 0, 1].max() - f[:, 0, 1].min())
    return _summary({
        "1_gate": _gate_line(gate_report),
        "2_hang": {"ok": bool(hang >= 9), "value": {"frames": int(hang), "closest_wrists_m": wrist_err}, "limit": ">= 9 frames within 5 cm of the ledge, no foot on the ground or deck"},
        "3_pull_up": {"ok": pull, "value": {"hips_above_deck": round(above, 3), "ankle_height_dev": round(foot_dev, 3), "ankle_z_min": round(foot_z, 3), "hang_ends_at": int(hang_end)},
                      "limit": "after the hang, last 5 frames: hips >= 0.8 m above the deck, ankles within 10 cm of deck height and past the edge"},
        "4_wall_and_deck": {"ok": bool(pen <= 0.02), "value": round(pen, 4), "limit": "<= 0.02 m inside"},
        "5_shape": {"ok": bool(n == B_FRAMES and f.shape[1] == 30), "value": [n, f.shape[1]], "limit": f"{B_FRAMES} frames, 30 joints"},
        "6_rise": {"ok": bool(rise < 2.5), "value": round(rise, 3), "limit": "hips rise < 2.5 m"},
    })


def join(a, b, blend=BLEND):
    """A, then `blend` frames easing from A's last pose to B's first (bone lengths eased too), then B.

    a and b are (T, 30, 3) in the same (world) frame; B has already been placed on the ledge."""
    pa, pb = a[-1], b[0]
    mid = []
    for i in range(1, blend + 1):
        e = _smooth(i / (blend + 1))
        q = np.zeros_like(pa)
        q[0] = pa[0] + (pb[0] - pa[0]) * e
        for j in range(1, len(NAMES)):
            p = PARENTS[j]
            oa, ob = pa[j] - pa[p], pb[j] - pb[p]
            la, lb = np.linalg.norm(oa), np.linalg.norm(ob)
            d = oa / max(la, 1e-9) * (1 - e) + ob / max(lb, 1e-9) * e
            q[j] = q[p] + d / max(np.linalg.norm(d), 1e-9) * (la + (lb - la) * e)
        mid.append(q)
    return np.concatenate([a, np.array(mid), b], axis=0)
