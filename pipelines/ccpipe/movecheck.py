"""Move checks: does a clip that passed the plausibility gate actually show the move that was asked for (CC-64)?

The gate says a body could have done it; a move check says it is the roll (or the vault ...) and not a stumble.
Numbers come from the joints alone, so a Kimodo sample, a CMU trial and a filmed clip are judged the same way."""
import json
import re

import numpy as np

from .clip import Clip
from .motion import _runs
from .skeleton import IDX

ROLL_MIN_TURN_DEG = 300      # the trunk turns nearly a full circle forward
ROLL_MIN_TRAVEL_M = 0.6      # and the body moves on (the sim moves it, but a roll in place is a cartwheel of the spot)
ROLL_MAX_TRAVEL_M = 5.0
ROLL_MAX_S = 1.4             # the rolling part, not the run-in and get-up
ROLL_MAX_HIPS = 1.05         # the hips never rise above this share of their standing height (a front flip goes up; a roll stays low)
ROLL_MAX_AIR_S = 0.25        # and nothing is airborne longer than this inside the window (a roll keeps touching the ground)
ROLL_MIN_S = 0.3
ROLL_AXIS_MAX_OFF_DEG = 45   # the roll's line of travel may differ this much from the way the body faces at the start (a filmed body is not square to the camera); a bigger gap is a sideways move, not a roll
ROLL_AXIS_MIN_TRAVEL_M = 0.3 # below this the hips have not travelled, so there is no line to take
VAULT_AIR_MIN_S, VAULT_AIR_MAX_S = 0.2, 1.0   # both feet off the floor for this long
VAULT_MIN_TRAVEL_M = 1.0     # and the body travels on over the obstacle
VAULT_MAX_HIPS = 1.6         # the hips rise at most this share of their standing height: they clear a waist-high box and the hand pushes (a flip goes far higher and is also stopped by the trunk-turn limit)
VAULT_MAX_PITCH_DEG = 120    # the trunk never turns over
VAULT_HAND_LOW = 0.9         # a hand comes down to this share of the standing hips height ...
VAULT_HAND_AHEAD_M = 0.2     # ... and ahead of the hips: the hand on top of the obstacle
HURT_LOW_HIPS = 0.45         # the hips come down to this share of their standing height (a body on the ground) ...
HURT_STAND_MIN_M = 0.8       # it starts on its feet: the hips are at least this high (a person's hips stand about 0.9 to 1.1 m up)
HURT_MIN_DOWN_S = 0.5        # ... and stay there at least this long (it does not bounce straight back up)
HURT_MIN_TURN_DEG = 50       # the trunk goes well off the vertical (a stumble keeps the trunk near upright)
SLIDE_LOW_HIPS = 0.55        # the hips come down to this share of their standing height (a body sitting or lying on the ground) ...
SLIDE_MIN_LOW_S, SLIDE_MAX_LOW_S = 0.3, 1.6   # ... for at least this long and no longer than this (a slide, not a lie-down)
SLIDE_MIN_TRAVEL_M = 1.0     # and the hips travel on toward where the body faces while low (a slide goes somewhere; a drop to the floor does not)
SLIDE_MAX_TURN_DEG = 110     # the trunk may lean back or forward but never turns over (a roll or a flip is not a slide)
SLIDE_MAX_AIR_S = 0.2        # nothing is airborne longer than this inside the window (a slide keeps touching the ground)
UPRIGHT_HIPS = 0.55          # the hips at the ends of the window are above this share of the standing hips height


def search_cmu(index, terms, skip=()):
    """Trials of the CMU index whose description mentions a term (case-insensitive), minus the skipped phrases."""
    pats = [re.compile(r"\b" + re.escape(t), re.I) for t in terms]  # a term starts a word: "tumbl" must not match "stumble"
    skips = [s.lower() for s in skip]
    out = []
    for t in index:
        text = f"{t['desc']} | {t['subjectDesc']}"
        if any(p.search(t["desc"]) for p in pats) and not any(s in t["desc"].lower() for s in skips):
            out.append({"id": t["id"], "desc": t["desc"], "subject": t["subject"], "fps": t["fps"]})
    return out


def load_index(path):
    with open(path) as f:
        return json.load(f)


def facing(frames, t=0):
    """The way the body faces at frame t (a horizontal unit vector), from the hips' left-right line: not the way it travels,
    because a backward somersault travels backward and would otherwise read as a forward one."""
    left = frames[t, IDX["LeftLeg"]] - frames[t, IDX["RightLeg"]]
    left[1] = 0
    n = np.linalg.norm(left)
    left = left / n if n > 1e-9 else np.array([1.0, 0.0, 0.0])
    return np.cross(left, [0.0, 1.0, 0.0])


def roll_axis(frames):
    """The horizontal line the roll is measured along (a unit vector): the line the hips travel, pointing the way the body faces.

    A body filmed head-on is rarely square to the camera, so its start facing can be tens of degrees off the way it rolls
    and the turn then reads short (CC-222). The line of travel gives the plane the trunk really turns in. The sign still comes
    from the facing, so a backward somersault stays negative. If the hips barely travel, or travel more than 45 degrees off
    the facing (a sideways move), the facing is used: a cartwheel is never read as a roll."""
    face = facing(frames)
    d = frames[-1, IDX["Hips"]] - frames[0, IDX["Hips"]]
    d[1] = 0
    n = np.linalg.norm(d)
    if n < ROLL_AXIS_MIN_TRAVEL_M:
        return face
    d = d / n
    if d @ face < 0:
        d = -d
    if np.degrees(np.arccos(np.clip(d @ face, -1, 1))) > ROLL_AXIS_MAX_OFF_DEG:
        return face
    return d


def trunk_pitch_deg(frames, axis=None):
    """Turn of the hips-to-neck line in the plane of 'up' and a horizontal axis, degrees, unwrapped (the axis is the way the body
    faces at the start unless one is given): 0 upright, +90 leaning toward the axis, +180 upside down; a backward somersault counts negative."""
    face = facing(frames) if axis is None else axis
    v = frames[:, IDX["Neck1"]] - frames[:, IDX["Hips"]]
    return np.degrees(np.unwrap(np.arctan2(v @ face, v[:, 1])))


def roll_window(frames, margin_deg=20):
    """(first, last) frame of the turning part: from 20 degrees of forward lean to 20 degrees short of the end of the turn."""
    p = trunk_pitch_deg(frames, roll_axis(frames))
    p = p - p[0]
    hi = int(np.argmax(p))
    start = np.where(p >= margin_deg)[0]
    if len(start) == 0:
        return None
    a = int(start[0])
    if a >= len(p) - 1:
        return None
    end = np.where(p[a:] >= p[hi] - margin_deg)[0]
    b = a + int(end[0]) if len(end) else hi
    return (a, min(max(b, a + 1), len(p) - 1))


def roll_check(clip):
    """(ok, numbers, window) for a clip that should be a forward roll. The window is the rolling part, in frames."""
    f, fps = clip.frames, clip.fps
    pitch = trunk_pitch_deg(f, roll_axis(f))
    pitch = pitch - pitch[0]
    win = roll_window(f)
    nums = {"max_turn_deg": round(float(pitch.max()), 1), "min_turn_deg": round(float(pitch.min()), 1)}
    if win is None:
        nums["why"] = "the trunk never leans forward"
        return False, nums, None
    a, b = win
    move = f[b, IDX["Hips"]] - f[a, IDX["Hips"]]
    travel = float(move @ facing(f))  # metres toward where the body faces
    inverted = bool((np.abs(pitch[a:b + 1] % 360 - 180) < 60).any())
    standing = float(f[0, IDX["Hips"], 1])  # the clip starts upright, on its feet
    ends_up = bool(f[0, IDX["Hips"], 1] > UPRIGHT_HIPS * standing and f[-1, IDX["Hips"], 1] > UPRIGHT_HIPS * standing)
    peak = float(f[a:b + 1, IDX["Hips"], 1].max() / standing)
    air = f[a:b + 1, :, 1].min(axis=1) > 0.15  # no joint within 15 cm of the floor
    air_s = max(((y - x) for x, y in _runs(air)), default=0) / fps
    nums.update(peak_hips_vs_standing=round(peak, 2), longest_air_s=round(air_s, 2), window_frames=[a, b], window_s=round((b - a) / fps, 2), turn_in_window_deg=round(float(pitch[b] - pitch[a]), 1),
                travel_m=round(travel, 2), upside_down=inverted, starts_and_ends_upright=ends_up)
    ok = (pitch.max() >= ROLL_MIN_TURN_DEG and inverted and ROLL_MIN_TRAVEL_M <= travel <= ROLL_MAX_TRAVEL_M
          and ROLL_MIN_S <= (b - a) / fps <= ROLL_MAX_S and ends_up and peak <= ROLL_MAX_HIPS and air_s <= ROLL_MAX_AIR_S)
    return bool(ok), nums, win


def vault_check(clip):
    """(ok, numbers, window) for a clip that should be a speed vault: both feet leave the floor for 0.2 to 1 s while the body travels on,
    a hand comes down low and ahead of the hips (on the obstacle), the trunk does not turn over, and the runner ends upright."""
    f, fps = clip.frames, clip.fps
    hips = f[:, IDX["Hips"]]
    standing = float(hips[0, 1])
    floor = float(min(f[:, IDX["LeftFoot"], 1].min(), f[:, IDX["RightFoot"], 1].min()))
    feet = np.minimum(f[:, IDX["LeftFoot"], 1], f[:, IDX["RightFoot"], 1]) - floor
    air = feet > 0.10
    runs = sorted(_runs(air), key=lambda r: r[1] - r[0], reverse=True)
    nums = {"standing_hips_m": round(standing, 2)}
    if not runs:
        nums["why"] = "the feet never leave the floor"
        return False, nums, None
    a, b = runs[0]
    b = max(b - 1, a)
    air_s = (b - a + 1) / fps
    face = facing(f)
    travel = float((hips[b] - hips[a]) @ face)
    lo = max(0, a - int(0.15 * fps)); hi = min(len(f) - 1, b + int(0.15 * fps))
    best_hand = None
    for name in ("LeftHand", "RightHand"):
        h = f[lo:hi + 1, IDX[name]]
        ahead = (h - hips[lo:hi + 1]) @ face
        low = h[:, 1] <= VAULT_HAND_LOW * standing
        ok_idx = np.where(low & (ahead >= VAULT_HAND_AHEAD_M))[0]
        if len(ok_idx):
            best_hand = name
            break
    pitch = trunk_pitch_deg(f) - trunk_pitch_deg(f)[0]
    peak = float(hips[:, 1].max() / standing)
    ends_up = bool(hips[-1, 1] > 0.8 * standing)
    nums.update(air_s=round(air_s, 2), window_frames=[a, b], travel_m=round(travel, 2), hand_plant=best_hand, peak_hips_vs_standing=round(peak, 2),
                max_trunk_turn_deg=round(float(np.abs(pitch).max()), 1), ends_upright=ends_up)
    ok = (VAULT_AIR_MIN_S <= air_s <= VAULT_AIR_MAX_S and travel >= VAULT_MIN_TRAVEL_M and best_hand is not None
          and peak <= VAULT_MAX_HIPS and np.abs(pitch).max() <= VAULT_MAX_PITCH_DEG and ends_up)
    return bool(ok), nums, (a, b)


def hurt_check(clip):
    """(ok, numbers, window) for a clip that should be a hard fall onto the front: it starts upright, the trunk goes forward well off the
    vertical, the hips come down to the ground and stay there for half a second. A stumble that recovers, a dip that comes straight back up
    and a fall onto the back are not it. The window runs from just before the fall starts to 0.6 s after the body is down (the standing
    lead-in is cut away; the game holds the last frame while the runner lies there)."""
    f, fps = clip.frames, clip.fps
    hips_y = f[:, IDX["Hips"], 1]
    standing = float(hips_y[: max(3, len(f) // 10)].mean())  # how high the hips are at the start (a dive may rise later: not the standing height)
    low = hips_y <= HURT_LOW_HIPS * standing
    runs = sorted(_runs(low), key=lambda r: r[1] - r[0], reverse=True)
    down_s = (runs[0][1] - runs[0][0]) / fps if runs else 0.0
    pitch = trunk_pitch_deg(f)
    forward = float(pitch.max())
    starts_up = bool(standing >= HURT_STAND_MIN_M)
    nums = {"standing_hips_m": round(standing, 2), "down_s": round(down_s, 2), "forward_turn_deg": round(forward, 1),
            "max_trunk_turn_deg": round(float(np.abs(pitch).max()), 1), "starts_upright": starts_up}
    ok = bool(down_s >= HURT_MIN_DOWN_S and forward >= HURT_MIN_TURN_DEG and starts_up)
    window = None
    if ok:
        start = int(runs[0][0])
        drop = np.where(hips_y[:start + 1] < 0.97 * standing)[0]
        begin = int(drop[0]) if len(drop) else 0
        # the last frame before the hips start to come down for good
        while begin > 0 and hips_y[begin - 1] < hips_y[begin] + 1e-6:
            begin -= 1
        window = (max(0, begin - 1), min(len(f) - 1, start + int(0.6 * fps)))
    return ok, nums, window


def slide_check(clip):
    """(ok, numbers, window) for a clip that should be a slide along the ground: it starts and ends on its feet, the hips come right down
    and stay low for 0.3 to 1.6 s while they travel on at least a metre, the trunk never turns over, and nothing flies. The window runs from
    just before the hips drop to just after they come back up (the run-in and the walk-off are cut)."""
    f, fps = clip.frames, clip.fps
    hips = f[:, IDX["Hips"]]
    standing = float(hips[: max(3, len(f) // 10), 1].mean())
    low = hips[:, 1] <= SLIDE_LOW_HIPS * standing
    runs = sorted(_runs(low), key=lambda r: r[1] - r[0], reverse=True)
    nums = {"standing_hips_m": round(standing, 2)}
    if not runs:
        nums["why"] = "the hips never come down"
        return False, nums, None
    a, b = runs[0][0], runs[0][1] - 1
    low_s = (b - a + 1) / fps
    face = facing(f)
    travel = float((hips[b] - hips[a]) @ face)
    pitch = trunk_pitch_deg(f)
    pitch = pitch - pitch[0]
    begin, end = a, b
    while begin > 0 and hips[begin - 1, 1] > hips[begin, 1] - 1e-6 and hips[begin - 1, 1] < 0.97 * standing:
        begin -= 1
    while end < len(f) - 1 and hips[end + 1, 1] > hips[end, 1] - 1e-6 and hips[end, 1] < 0.9 * standing:
        end += 1
    begin = max(0, begin - 1)
    floor = float(f[:, :, 1].min())
    air = f[begin:end + 1, :, 1].min(axis=1) > floor + 0.15
    air_s = max(((y - x) for x, y in _runs(air)), default=0) / fps
    starts_up = bool(hips[0, 1] > 0.8 * standing and standing >= HURT_STAND_MIN_M)
    ends_up = bool(hips[-1, 1] > 0.8 * standing)
    turn = float(np.abs(pitch[begin:end + 1]).max())
    nums.update(low_s=round(low_s, 2), travel_m=round(travel, 2), max_trunk_turn_deg=round(turn, 1), longest_air_s=round(air_s, 2),
                window_frames=[begin, end], starts_upright=starts_up, ends_upright=ends_up, min_hips_vs_standing=round(float(hips[:, 1].min() / standing), 2))
    ok = (SLIDE_MIN_LOW_S <= low_s <= SLIDE_MAX_LOW_S and travel >= SLIDE_MIN_TRAVEL_M and turn <= SLIDE_MAX_TURN_DEG
          and air_s <= SLIDE_MAX_AIR_S and starts_up and ends_up)
    return bool(ok), nums, (begin, end)


def generic_check(clip):
    """Moves without a special check are judged by the gate alone (and say so in the report)."""
    return True, {"note": "no move check for this move: the gate alone judged it"}, None


CHECKS = {"roll": roll_check, "vault": vault_check, "hurt": hurt_check, "slide": slide_check, "generic": generic_check}


def trim(clip, window, pad_s=0.1):
    """The clip cut to the window plus `pad_s` each side (the run-in and the get-up), re-centred on its first frame."""
    a, b = window
    pad = int(round(pad_s * clip.fps))
    lo, hi = max(0, a - pad), min(clip.n, b + pad + 1)
    f = clip.frames[lo:hi].copy()
    f[:, :, [0, 2]] -= f[0, IDX["Hips"], [0, 2]]
    return Clip(f, clip.fps, list(clip.names), list(clip.parents), dict(clip.meta))
