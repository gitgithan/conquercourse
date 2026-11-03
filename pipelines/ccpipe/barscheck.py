"""Move checks for the monkey bars (CC-133): does a clip that passed the gate show hanging, hand-over-hand travel or a kip?

Same idea as movecheck.py: the gate says a body could do it, this says it is the move that was asked for. Joints only, so a Kimodo
sample, a CMU trial, a filmed clip and the procedural fallback are judged by the same numbers. Clip axes: y up, travel along +z."""
import numpy as np

from .motion import _runs, speeds
from .skeleton import FEET, IDX

HANG_MIN_SHARE = 0.9          # both hands above the head and the feet off the floor for this share of the frames
FEET_OFF_M = 0.1              # lowest foot at least this high
GRIP_SPEED = 0.3              # m/s: a hand under this is gripping a rung
GRIP_MIN_S = 0.25             # a grip lasts at least this long
OTHER_HOLDS_SHARE = 0.9       # while one hand moves (over 0.5 m/s) the other grips for this share of those frames
MIN_ADVANCE_M = 0.3           # a hand's next grip is at least this far ahead of its last one
MIN_GRIPS_EACH = 2            # each hand grips at least this many different rungs
TRAVEL_MIN_M = 1.5            # hips travel at least this far along the bars (over about 5 s)
IDLE_MAX_TRAVEL_M = 0.3       # an idle hang stays put
IDLE_GRIP_SHARE = 0.95
KIP_MIN_SWING_M = 0.3         # the hips swing this far from front to back (peak to peak)
KIP_MIN_REVERSALS = 2
KIP_GRIP_SHARE = 0.9


def _hang_share(f):
    head = f[:, IDX["Head"], 1]
    up = (f[:, IDX["LeftHand"], 1] > head) & (f[:, IDX["RightHand"], 1] > head)
    off = f[:, FEET, 1].min(axis=1) > FEET_OFF_M
    return float((up & off).mean())


def _smooth(x, k=5):
    p = np.pad(x, ((k // 2, k // 2),) + ((0, 0),) * (x.ndim - 1), mode="edge")
    return np.stack([p[i:i + len(x)] for i in range(k)]).mean(0)


def _grips(f, fps, joint):
    """[(first frame, last frame, mean z)] of the stretches where the hand holds still."""
    sp = speeds(_smooth(f), fps)[:, joint]
    out = []
    for a, b in _runs(sp < GRIP_SPEED):
        if (b - a) / fps >= GRIP_MIN_S:
            out.append((a, b - 1, float(f[a:b, joint, 2].mean())))
    return out


def hang_numbers(clip):
    f = clip.frames
    return {"hang_share": round(_hang_share(f), 3), "hips_travel_m": round(float(f[-1, 0, 2] - f[0, 0, 2]), 3)}


def travel_check(clip):
    """Hand over hand: each hand moves on to a rung further along while the other holds, again and again, and the body goes with them."""
    f, fps = clip.frames, clip.fps
    sp = speeds(_smooth(f), fps)
    n = {**hang_numbers(clip)}
    ok = n["hang_share"] >= HANG_MIN_SHARE and n["hips_travel_m"] >= TRAVEL_MIN_M
    moving = {j: sp[:, IDX[j]] > 0.5 for j in ("LeftHand", "RightHand")}
    for me, other in (("LeftHand", "RightHand"), ("RightHand", "LeftHand")):
        g = _grips(f, fps, IDX[me])
        advances = [b[2] - a[2] for a, b in zip(g, g[1:])]
        forward = [x for x in advances if x >= MIN_ADVANCE_M]
        holds = float((~moving[other][moving[me]]).mean()) if moving[me].any() else 0.0
        n[me] = {"grips": len(g), "forward_steps": len(forward), "other_hand_holds_share": round(holds, 3),
                 "backward_steps": len([x for x in advances if x <= -MIN_ADVANCE_M])}
        ok &= len(forward) >= MIN_GRIPS_EACH - 1 and holds >= OTHER_HOLDS_SHARE and n[me]["backward_steps"] == 0
    both = (moving["LeftHand"] & moving["RightHand"]).mean()
    n["both_hands_moving_share"] = round(float(both), 3)
    ok &= both < 0.1
    return bool(ok), n


def idle_check(clip):
    f, fps = clip.frames, clip.fps
    n = hang_numbers(clip)
    held = np.mean([np.mean(speeds(_smooth(f), fps)[:, IDX[j]] < GRIP_SPEED * 2) for j in ("LeftHand", "RightHand")])
    n["grip_share"] = round(float(held), 3)
    return bool(n["hang_share"] >= HANG_MIN_SHARE and abs(n["hips_travel_m"]) <= IDLE_MAX_TRAVEL_M and held >= IDLE_GRIP_SHARE), n


def kip_check(clip):
    """A kip: the hands stay on the rung, the hips swing forward and back under them."""
    f, fps = clip.frames, clip.fps
    n = hang_numbers(clip)
    held = np.mean([np.mean(speeds(_smooth(f), fps)[:, IDX[j]] < GRIP_SPEED * 2) for j in ("LeftHand", "RightHand")])
    z = _smooth(f[:, 0, 2], 9)
    sign = np.sign(np.diff(z)[np.abs(np.diff(z)) > 1e-4])
    reversals = int((np.diff(sign) != 0).sum()) if len(sign) > 1 else 0
    n.update({"grip_share": round(float(held), 3), "swing_p2p_m": round(float(np.ptp(z)), 3), "reversals": reversals})
    return bool(n["hang_share"] >= HANG_MIN_SHARE and held >= KIP_GRIP_SHARE and np.ptp(z) >= KIP_MIN_SWING_M and reversals >= KIP_MIN_REVERSALS), n


CHECKS = {"travel": travel_check, "idle": idle_check, "kip": kip_check}
