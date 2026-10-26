"""The only repairs allowed before the gate (docs/pipelines.md, pipeline 4). Each returns a new clip and a count."""
import numpy as np

from . import gate, motion
from .motion import G, unit
from .skeleton import IDX


def _leg(side):
    return tuple(IDX[f"{side}{j}"] for j in ("Leg", "Shin", "Foot", "ToeBase"))


def _two_bone_knee(hip, ankle, l1, l2, axis, prefer):
    """Knee position with hip and ankle fixed, bone lengths kept, hinge axis (thigh x shin) along `axis`."""
    d = ankle - hip
    dist = np.linalg.norm(d)
    dist = min(max(dist, abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6)
    dhat = unit(d)
    a = axis - dhat * np.dot(axis, dhat)  # the hinge must be perpendicular to the leg line
    a = unit(a)
    along = (l1 ** 2 - l2 ** 2 + dist ** 2) / (2 * dist)
    h = np.sqrt(max(l1 ** 2 - along ** 2, 0.0))
    # thigh x shin along +a puts the knee on the side a x dhat... pick the sign by test
    for sign in (1.0, -1.0):
        knee = hip + dhat * along + sign * h * unit(np.cross(a, dhat))
        if np.dot(np.cross(knee - hip, ankle - knee), a) >= 0:
            return knee
    return hip + dhat * along


def fix_knees(clip):
    """A knee bent backwards or a leg turned round gets its knee on the plane whose hinge axis is the hips' side axis."""
    f = clip.frames.copy()
    side = motion.side_axis(f)
    changed = 0
    for s in ("Left", "Right"):
        hip_i, kn_i, an_i, _ = _leg(s)
        bend, ang = motion.knee(f, s)
        for t in np.where((bend > gate.KNEE_JUDGED_ABOVE_DEG) & (ang > gate.KNEE_TWISTED_DEG))[0]:
            l1 = np.linalg.norm(f[t, kn_i] - f[t, hip_i])
            l2 = np.linalg.norm(f[t, an_i] - f[t, kn_i])
            f[t, kn_i] = _two_bone_knee(f[t, hip_i], f[t, an_i], l1, l2, side[t], None)
            changed += 1
    return clip.copy(f), changed


def lift_to_floor(clip, floor=0.0):
    """A frame whose lowest joint is under the floor is raised."""
    f = clip.frames.copy()
    low = f[:, :, 1].min(axis=1)
    under = low < floor
    f[under, :, 1] += (floor - low[under])[:, None]
    return clip.copy(f), int(under.sum())


def limit_knee_bend(clip, max_bend=gate.KNEE_MAX_BEND_DEG - 1.0):
    """A knee folded past `max_bend` on a foot in the air is opened by turning the shin about the knee."""
    f = clip.frames.copy()
    changed = 0
    for s in ("Left", "Right"):
        hip_i, kn_i, an_i, toe_i = _leg(s)
        bend, _ = motion.knee(f, s)
        for t in np.where((bend > max_bend) & (f[:, an_i, 1] > 0.1))[0]:
            thigh, shin = f[t, kn_i] - f[t, hip_i], f[t, an_i] - f[t, kn_i]
            axis = unit(np.cross(thigh, shin))
            # rotate the shin direction about the axis so the bend equals max_bend
            th = unit(thigh)
            new_dir = th * np.cos(np.radians(max_bend)) + np.cross(axis, th) * np.sin(np.radians(max_bend))
            new_ankle = f[t, kn_i] + new_dir * np.linalg.norm(shin)
            delta = new_ankle - f[t, an_i]
            f[t, an_i] += delta
            f[t, toe_i] += delta
            changed += 1
    return clip.copy(f), changed


def make_ballistic(clip, gravity=None):
    """Each airborne frame is moved straight up or down until the centre of mass sits on a parabola
    pinned at take-off and landing; the pose is unchanged."""
    gravity = gravity or clip.meta.get("gravity", G)
    f = clip.frames.copy()
    sup = motion.supported(f, clip.fps)
    fl = motion.longest_flight(sup)
    if fl is None:
        return clip.copy(f), 0
    a, b = fl
    t0, t1 = max(a - 1, 0), min(b, clip.n - 1)  # last supported frame before, first supported after
    cy = motion.com(f)[:, 1]
    span = (t1 - t0) / clip.fps
    y0, y1 = cy[t0], cy[t1]
    v0 = (y1 - y0) / span + 0.5 * gravity * span
    for t in range(t0 + 1, t1):
        tau = (t - t0) / clip.fps
        f[t, :, 1] += (y0 + v0 * tau - 0.5 * gravity * tau ** 2) - cy[t]
    return clip.copy(f), t1 - t0 - 1


def repair(clip):
    """Run all repairs in order (knees, floor, knee limit, ballistic); returns the clip and what each did."""
    log = {}
    clip, log["fix_knees"] = fix_knees(clip)
    clip, log["lift_to_floor"] = lift_to_floor(clip)
    clip, log["limit_knee_bend"] = limit_knee_bend(clip)
    if not clip.meta.get("supportedBy"):
        clip, log["make_ballistic"] = make_ballistic(clip)
    return clip, log
