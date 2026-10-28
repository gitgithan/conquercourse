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


def trunk_pitch_deg(frames):
    """Turn of the hips-to-neck line in the plane of 'up' and the way the body faces at the start, degrees, unwrapped:
    0 upright, +90 leaning toward where it faces, +180 upside down; a backward somersault counts negative."""
    face = facing(frames)
    v = frames[:, IDX["Neck1"]] - frames[:, IDX["Hips"]]
    return np.degrees(np.unwrap(np.arctan2(v @ face, v[:, 1])))


def roll_window(frames, margin_deg=20):
    """(first, last) frame of the turning part: from 20 degrees of forward lean to 20 degrees short of the end of the turn."""
    p = trunk_pitch_deg(frames) - trunk_pitch_deg(frames)[0]
    hi = int(np.argmax(p))
    start = np.where(p >= margin_deg)[0]
    if len(start) == 0:
        return None
    a = int(start[0])
    end = np.where(p[a:] >= p[hi] - margin_deg)[0]
    b = a + int(end[0]) if len(end) else hi
    return (a, max(b, a + 1))


def roll_check(clip):
    """(ok, numbers, window) for a clip that should be a forward roll. The window is the rolling part, in frames."""
    f, fps = clip.frames, clip.fps
    pitch = trunk_pitch_deg(f) - trunk_pitch_deg(f)[0]
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


def generic_check(clip):
    """Moves without a special check are judged by the gate alone (and say so in the report)."""
    return True, {"note": "no move check for this move: the gate alone judged it"}, None


CHECKS = {"roll": roll_check, "generic": generic_check}


def trim(clip, window, pad_s=0.25):
    """The clip cut to the window plus `pad_s` each side (the run-in and the get-up), re-centred on its first frame."""
    a, b = window
    pad = int(round(pad_s * clip.fps))
    lo, hi = max(0, a - pad), min(clip.n, b + pad + 1)
    f = clip.frames[lo:hi].copy()
    f[:, :, [0, 2]] -= f[0, IDX["Hips"], [0, 2]]
    return Clip(f, clip.fps, list(clip.names), list(clip.parents), dict(clip.meta))
