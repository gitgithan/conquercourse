"""The plausibility gate: no clip a real body couldn't make is ever shown.

Hard rules block publishing; soft rules are reported. See docs/pipelines.md, pipeline 4."""
import numpy as np

from . import motion
from .clip import Clip
from .motion import G
from .skeleton import BONES, FEET, IDX

VERSION = 1
KNEE_JUDGED_ABOVE_DEG = 15      # a knee bent less than this has no meaningful hinge axis
KNEE_BACKWARDS_DEG = 120        # hinge axis this far from the side axis: bent backwards
KNEE_TWISTED_DEG = 60           # a leg turned round more than this from the side axis
KNEE_MAX_BEND_DEG = 165
GRAVITY_TOLERANCE = 0.15
FEET_SINK_M = 0.03
MAX_HIP_SPEED = 12.0
BONE_LENGTH_TOLERANCE = 0.02
FOOT_SLIDE_M = 0.03
MAX_ACCEL = 200.0
MAX_UNHELD_S = 1.0              # in a clip held by something, no stretch longer than this may have nothing touching the body;
                                # 1.0 s (was 0.6) because a real hand plant rolls the wrist at 0.3 to 0.8 m/s, so the still-hand
                                # proxy misses it: the captured vault and climb are held for 0.87 to 0.97 s by hands the contact
                                # detector does find (data/eval/motion-vault/outputs/*/contacts.json)


def _rule(ok, value, limit, note=""):
    return {"ok": bool(ok), "value": None if value is None else round(float(value), 4), "limit": limit, "note": note}


def knee_rules(frames):
    worst_back = worst_twist = worst_bend = 0.0
    for side in ("Left", "Right"):
        bend, ang = motion.knee(frames, side)
        judged = bend > KNEE_JUDGED_ABOVE_DEG
        if judged.any():
            worst_back = max(worst_back, float(ang[judged].max()))
            worst_twist = max(worst_twist, float(ang[judged].max()))
        worst_bend = max(worst_bend, float(bend.max()))
    return {
        "knees_bend_forward": _rule(worst_back < KNEE_BACKWARDS_DEG, worst_back, f"< {KNEE_BACKWARDS_DEG} deg off the side axis"),
        "legs_not_twisted": _rule(worst_twist <= KNEE_TWISTED_DEG, worst_twist, f"<= {KNEE_TWISTED_DEG} deg off the side axis"),
        "knees_within_range": _rule(worst_bend <= KNEE_MAX_BEND_DEG, worst_bend, f"<= {KNEE_MAX_BEND_DEG} deg"),
    }


def flight_rule(clip):
    gravity = clip.meta.get("gravity", G)
    if clip.meta.get("supportedBy"):
        return _rule(True, None, "not judged", f"held by {clip.meta['supportedBy']}")
    sup = motion.supported(clip.frames, clip.fps)
    fl = motion.longest_flight(sup)
    if fl is None:
        return _rule(True, None, "no flight", "no unsupported stretch of 0.2 s or more")
    a, b = fl
    g = motion.fit_gravity(motion.com(clip.frames)[a:b, 1], clip.fps)
    err = abs(g - gravity) / gravity
    return _rule(err <= GRAVITY_TOLERANCE, g, f"within {int(GRAVITY_TOLERANCE * 100)}% of {gravity}", f"frames {a}-{b - 1}, off by {err:.1%}")


def held_rule(clip):
    """A clip marked `supportedBy` isn't judged as free flight, but something must be holding the body:
    no stretch with the feet off the floor and no still hand or foot may last longer than MAX_UNHELD_S."""
    if not clip.meta.get("supportedBy"):
        return None
    sup = motion.supported(clip.frames, clip.fps)
    runs = motion._runs(~sup)
    longest = max(((b - a) / clip.fps for a, b in runs), default=0.0)
    return _rule(longest <= MAX_UNHELD_S, longest, f"<= {MAX_UNHELD_S} s with nothing holding the body", f"held by {clip.meta['supportedBy']}")


def hard_rules(clip):
    f = clip.frames
    rules = knee_rules(f)
    rules["flight_is_ballistic"] = flight_rule(clip)
    held = held_rule(clip)
    if held:
        rules["held_clips_are_held"] = held
    sink = -float(f[:, FEET, 1].min())
    rules["feet_dont_sink"] = _rule(sink <= FEET_SINK_M, sink, f"<= {FEET_SINK_M} m under the floor")
    hip = float(motion.speeds(f, clip.fps)[:, IDX["Hips"]].max())
    rules["no_teleport"] = _rule(hip <= MAX_HIP_SPEED, hip, f"<= {MAX_HIP_SPEED} m/s")
    return rules


def soft_rules(clip):
    f, fps = clip.frames, clip.fps
    lengths = np.stack([np.linalg.norm(f[:, i] - f[:, p], axis=-1) for p, i in BONES], axis=1)
    med = np.median(lengths, axis=0)
    bone = float(np.abs(lengths / np.maximum(med, 1e-9) - 1).max())
    slide = 0.0
    sp = motion.speeds(f, fps)
    for j in FEET:
        y = f[:, j, 1]
        # a planted foot: within 5 cm of its lowest point, near the floor, and moving under 1 m/s (a swinging foot skims the floor too)
        for a, b in motion._runs((y < min(y.min() + 0.05, 0.15)) & (sp[:, j] < 1.0)):
            if b - a >= 2:
                xz = f[a:b, j][:, [0, 2]]
                slide = max(slide, float(np.linalg.norm(xz - xz[0], axis=-1).max()))
    acc = float(np.linalg.norm(np.diff(f, 2, axis=0), axis=-1).max() * fps ** 2) if clip.n > 2 else 0.0
    return {
        "bones_keep_length": _rule(bone <= BONE_LENGTH_TOLERANCE, bone, f"<= {BONE_LENGTH_TOLERANCE:.0%} off the median"),
        "feet_dont_slide": _rule(slide <= FOOT_SLIDE_M, slide, f"<= {FOOT_SLIDE_M} m"),
        "no_jitter": _rule(acc <= MAX_ACCEL, acc, f"<= {MAX_ACCEL} m/s^2"),
    }


def run_gate(clip):
    """Gate report: {"pass": all hard rules ok, "hard": {...}, "soft": {...}}."""
    assert len(clip.names) == clip.frames.shape[1], "names and joints differ in length"
    hard, soft = hard_rules(clip), soft_rules(clip)
    return {"version": VERSION, "pass": all(r["ok"] for r in hard.values()), "hard": hard, "soft": soft}


def failures(report):
    return [k for k, r in report["hard"].items() if not r["ok"]]


def clip_from_times(frames, times, floor=0.0, **meta):
    """A Clip from measured video: (T, 30, 3) metres, y up, each frame's own time in seconds.

    The floor becomes y = 0. The gate works on an even clock, so frames are resampled to the clip's average rate
    only when the times are uneven (more than 2 % of a frame off); constant-rate video is never resampled."""
    frames, t = np.asarray(frames, float), np.asarray(times, float)
    assert len(frames) == len(t) >= 2 and np.all(np.diff(t) > 0), "times must increase, one per frame"
    fps = (len(t) - 1) / (t[-1] - t[0])
    even = t[0] + np.arange(len(t)) / fps
    if np.abs(t - even).max() * fps > 0.02:
        flat = frames.reshape(len(t), -1)
        frames = np.stack([np.interp(even, t, flat[:, c]) for c in range(flat.shape[1])], axis=1).reshape(frames.shape)
    frames = frames.copy()
    frames[:, :, 1] -= floor
    return Clip(frames, fps, meta=meta)


def run_gate_times(frames, times, floor=0.0, gravity=G, supported_by=None):
    """The gate on measured video (see clip_from_times); `supported_by` marks a clip held by equipment."""
    meta = {"gravity": gravity}
    if supported_by:
        meta["supportedBy"] = supported_by
    return run_gate(clip_from_times(frames, times, floor, **meta))
