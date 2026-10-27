"""Measurements shared by the gate and the repairs: knees, centre of mass, support."""
import numpy as np

from .skeleton import IDX, FEET, HANDS

G = 9.81

# Winter's segment masses (fraction of body mass), as (proximal, distal, mass, centre fraction from proximal)
_SEGMENTS = [("Neck1", "Head", 0.081, 1.0), ("Hips", "Neck1", 0.497, 0.5)]
for _s in ("Left", "Right"):
    _SEGMENTS += [
        (f"{_s}Arm", f"{_s}ForeArm", 0.028, 0.436), (f"{_s}ForeArm", f"{_s}Hand", 0.016, 0.430),
        (f"{_s}Hand", f"{_s}HandMiddleEnd", 0.006, 0.506), (f"{_s}Leg", f"{_s}Shin", 0.100, 0.433),
        (f"{_s}Shin", f"{_s}Foot", 0.0465, 0.433), (f"{_s}Foot", f"{_s}ToeBase", 0.0145, 0.5),
    ]
assert abs(sum(m for _, _, m, _ in _SEGMENTS) - 1.0) < 1e-9


def unit(v, eps=1e-9):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), eps)


def com(frames):
    out = np.zeros((frames.shape[0], 3))
    for a, b, m, f in _SEGMENTS:
        out += m * (frames[:, IDX[a]] + f * (frames[:, IDX[b]] - frames[:, IDX[a]]))
    return out


def side_axis(frames):
    """The hips' side axis (left hip minus right hip), unit, per frame."""
    return unit(frames[:, IDX["LeftLeg"]] - frames[:, IDX["RightLeg"]])


def knee(frames, side):
    """Bend (degrees, 0 = straight) and the angle between the knee's hinge axis and the hips' side axis."""
    hip, kn, an = (frames[:, IDX[f"{side}{j}"]] for j in ("Leg", "Shin", "Foot"))
    thigh, shin = kn - hip, an - kn
    cos = np.clip(np.sum(unit(thigh) * unit(shin), axis=-1), -1, 1)
    bend = np.degrees(np.arccos(cos))
    axis = unit(np.cross(thigh, shin))
    ang = np.degrees(np.arccos(np.clip(np.sum(axis * side_axis(frames), axis=-1), -1, 1)))
    return bend, ang


def speeds(frames, fps):
    """Per-frame speed of every joint (m/s), central differences, ends one-sided."""
    v = np.gradient(frames, axis=0) * fps
    return np.linalg.norm(v, axis=-1)


def _runs(mask):
    """(start, stop) of consecutive True runs, stop exclusive."""
    out, start = [], None
    for i, m in enumerate(mask):
        if m and start is None:
            start = i
        if not m and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def still(frames, fps, joint, thresh, min_frames):
    """Frames where `joint` stays under `thresh` m/s for at least `min_frames` in a row."""
    sp = speeds(frames, fps)[:, joint]
    m = np.zeros(len(sp), bool)
    for a, b in _runs(sp < thresh):
        if b - a >= min_frames:
            m[a:b] = True
    return m


def supported(frames, fps, floor=0.0):
    """True where the body is held: lowest joint within 15 cm of the floor, or a hand or foot is still.

    A hand above the head counts as gripping up to 1.0 m/s (the wrist rolls round a bar)."""
    m = frames[:, :, 1].min(axis=1) <= floor + 0.15
    for j in FEET:
        m |= still(frames, fps, j, 0.3, 4)
    head_y = frames[:, IDX["Head"], 1]
    for j in HANDS:
        m |= still(frames, fps, j, 0.3, 4)
        high = frames[:, j, 1] > head_y
        sp = speeds(frames, fps)[:, j]
        for a, b in _runs((sp < 1.0) & high):
            if b - a >= 4:
                m[a:b] = True
    return m


MIN_FLIGHT_FRAMES = 6  # shorter than 0.2 s at 30 fps is too few samples to fit gravity


def longest_flight(sup, min_frames=MIN_FLIGHT_FRAMES):
    """(start, stop) of the longest unsupported stretch, or None if shorter than `min_frames`."""
    runs = _runs(~np.asarray(sup))
    if not runs:
        return None
    a, b = max(runs, key=lambda r: r[1] - r[0])
    return (a, b) if b - a >= min_frames else None


def fit_gravity(com_y, fps):
    """Fitted g (m/s²) of a parabola through the centre-of-mass heights."""
    t = np.arange(len(com_y)) / fps
    return -2.0 * np.polyfit(t, com_y, 2)[0]


def planted_foot_height(frames, fps):
    """Highest height (m) at which a foot stays still for at least 3 frames while the body travels (a plant on a wall)."""
    best = 0.0
    for j in FEET:
        m = still(frames, fps, j, 0.5, 3)
        if m.any():
            best = max(best, float(frames[m, j, 1].max()))
    return best


def grip_frames(frames, fps):
    """Frames where a hand is still above the head with the feet off the ground: a grip on something overhead."""
    head_y = frames[:, IDX["Head"], 1]
    off = frames[:, FEET, 1].min(axis=1) > 0.15
    m = np.zeros(len(frames), bool)
    for j in HANDS:
        sp = speeds(frames, fps)[:, j]
        high = frames[:, j, 1] > head_y
        for a, b in _runs((sp < 1.0) & high):
            if b - a >= 4:
                m[a:b] = True
    return m & off
