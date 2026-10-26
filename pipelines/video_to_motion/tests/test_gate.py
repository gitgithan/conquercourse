import sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parents[1]))
from gate import run_gate, fix_knees, lift_to_floor, knee_info
from joints import NAMES, IDX


def standing(T, times, hip_y=None):
    """a stiff standing body facing +z, left on +x; hip_y: (T,) heights"""
    base = {"Hips": (0, .95, 0), "Spine1": (0, 1.05, 0), "Spine2": (0, 1.15, 0), "Chest": (0, 1.3, 0), "Neck1": (0, 1.45, 0),
            "Neck2": (0, 1.52, 0), "Head": (0, 1.62, 0), "Jaw": (0, 1.6, .08), "LeftEye": (.03, 1.66, .08), "RightEye": (-.03, 1.66, .08)}
    for s, x in (("Left", 1), ("Right", -1)):
        base.update({s + "Shoulder": (.12 * x, 1.42, 0), s + "Arm": (.2 * x, 1.42, 0), s + "ForeArm": (.22 * x, 1.14, 0),
                     s + "Hand": (.22 * x, .88, 0), s + "HandThumbEnd": (.22 * x, .8, .03), s + "HandMiddleEnd": (.22 * x, .78, 0),
                     s + "Leg": (.09 * x, .92, 0), s + "Shin": (.09 * x, .5, .02), s + "Foot": (.09 * x, .08, 0), s + "ToeBase": (.09 * x, .02, .12)})
    p = np.array([base[n] for n in NAMES])
    m = np.tile(p, (T, 1, 1))
    if hip_y is not None:
        m[:, :, 1] += (hip_y - .95)[:, None]
    return m


def test_free_fall_passes_and_wrong_gravity_fails():
    t = np.arange(0, 1.0, 1 / 30)
    h = 1.6 + 3.0 * (t - t[0]) * 0 + 0  # placeholder
    for g, ok in ((9.81, True), (3.0, False)):
        y = 1.2 + 4.0 * t - 0.5 * g * t ** 2
        y = np.maximum(y, 0.95)
        # the whole body is airborne; start and end on ground handled by the floor: lift body by 0.4 so nothing is within 15 cm
        m = standing(len(t), t, y + 0.4)
        r = run_gate(m, t)
        assert r["hard"]["flight_ballistic"]["ok"] == ok, r["hard"]["flight_ballistic"]


def test_backwards_knee_fails_then_repair_passes():
    t = np.arange(0, 1, 1 / 30)
    m = standing(len(t), t)
    for s in ("Left", "Right"):
        m[:, IDX[s + "Shin"], 2] = -0.25 * 0 + 0.25   # knee pushed backward of a straight, bent-forward-looking leg
        m[:, IDX[s + "Foot"], 2] = -0.0
    # foot behind knee means a normal knee flexing forward would have the foot behind; here the knee is behind => reversed
    m2 = m.copy()
    bend, ang = knee_info(m2, "Left")
    assert ang.max() < 180
    fixed = fix_knees(m2)
    assert run_gate(fixed, t, supported_by="floor")["hard"]["knee_range"]["ok"]


def test_teleport_fails():
    t = np.arange(0, 1, 1 / 30)
    m = standing(len(t), t)
    m[:, :, 0] += (t * 20)[:, None]
    assert not run_gate(m, t)["hard"]["no_teleport"]["ok"]


def test_sunk_feet_lifted():
    t = np.arange(0, 1, 1 / 30)
    m = standing(len(t), t, np.full(len(t), .8))
    assert not run_gate(m, t)["hard"]["feet_dont_sink"]["ok"]
    assert run_gate(lift_to_floor(m), t)["hard"]["feet_dont_sink"]["ok"]
