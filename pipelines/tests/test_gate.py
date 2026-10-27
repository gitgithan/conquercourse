import numpy as np
import pytest

from ccpipe import gate, motion, repairs
from ccpipe.clip import Clip
from ccpipe.skeleton import IDX, N_JOINTS
from synth import body, jump, standing


def hard(clip):
    return gate.run_gate(clip)["hard"]


def test_a_standing_body_passes():
    r = gate.run_gate(standing(speed=0.0))
    assert r["pass"], gate.failures(r)


def test_names_and_joints_must_match():
    with pytest.raises(AssertionError):
        Clip(np.zeros((3, N_JOINTS - 1, 3)), 30.0)


def test_knee_bent_backwards_fails():
    c = standing(bend_l=60, bend_r=60, backwards=True)
    assert not hard(c)["knees_bend_forward"]["ok"]


def test_forward_bend_passes_and_small_backwards_bend_is_not_judged():
    assert hard(standing(bend_l=90, bend_r=90))["knees_bend_forward"]["ok"]
    assert hard(standing(bend_l=10, bend_r=10, backwards=True))["knees_bend_forward"]["ok"]  # under 15 degrees


def test_twisted_leg_fails():
    c = standing(bend_l=60, bend_r=60, twist_l=80)
    assert not hard(c)["legs_not_twisted"]["ok"]


def test_knee_range_limit_is_165_degrees():
    assert hard(standing(bend_l=160, bend_r=160))["knees_within_range"]["ok"]
    assert not hard(standing(bend_l=170, bend_r=170))["knees_within_range"]["ok"]


def test_feet_sinking_more_than_3cm_fails_and_lift_repairs_it():
    c = standing()
    f = c.frames.copy()
    f[:, :, 1] -= 0.05
    sunk = c.copy(f)
    assert not hard(sunk)["feet_dont_sink"]["ok"]
    fixed, n = repairs.lift_to_floor(sunk)
    assert n == sunk.n and hard(fixed)["feet_dont_sink"]["ok"]
    f[:, :, 1] += 0.04  # 1 cm under the floor is within tolerance
    assert hard(c.copy(f))["feet_dont_sink"]["ok"]


def test_teleport_over_12_m_per_s_fails():
    c = standing(speed=13.0)
    assert not hard(c)["no_teleport"]["ok"]
    assert hard(standing(speed=11.0))["no_teleport"]["ok"]


def test_ballistic_flight_at_earth_gravity_passes():
    r = hard(jump(g=9.81))["flight_is_ballistic"]
    assert r["ok"] and abs(r["value"] - 9.81) < 0.3


def test_flight_at_wrong_gravity_fails_and_make_ballistic_fixes_it():
    c = jump(g=5.0, flight_frames=18)
    assert not hard(c)["flight_is_ballistic"]["ok"]
    fixed, n = repairs.make_ballistic(c)
    assert n > 0
    r = hard(fixed)["flight_is_ballistic"]
    assert r["ok"] and abs(r["value"] - 9.81) / 9.81 < 0.02


def test_make_ballistic_keeps_the_pose():
    c = jump(g=5.0, flight_frames=18)
    fixed, _ = repairs.make_ballistic(c)
    rel = lambda f: f - f[:, IDX["Hips"]][:, None]
    assert np.allclose(rel(fixed.frames), rel(c.frames), atol=1e-9)


def test_clip_gravity_is_respected_and_supported_clips_are_not_judged_as_flight():
    assert hard(jump(g=5.0).copy(gravity=5.0))["flight_is_ballistic"]["ok"]
    held = jump(g=5.0).copy(supportedBy=["a bar"])
    assert hard(held)["flight_is_ballistic"]["ok"]


def test_fix_knees_turns_a_backwards_knee_forward_keeping_hip_ankle_and_lengths():
    c = standing(bend_l=70, bend_r=70, backwards=True)
    fixed, n = repairs.fix_knees(c)
    assert n == 2 * c.n
    assert hard(fixed)["knees_bend_forward"]["ok"] and hard(fixed)["legs_not_twisted"]["ok"]
    for s in ("Left", "Right"):
        for part in ("Leg", "Foot"):
            assert np.allclose(fixed.frames[:, IDX[f"{s}{part}"]], c.frames[:, IDX[f"{s}{part}"]])
        for a, b in (("Leg", "Shin"), ("Shin", "Foot")):
            la = np.linalg.norm(fixed.frames[:, IDX[s + a]] - fixed.frames[:, IDX[s + b]], axis=-1)
            lb = np.linalg.norm(c.frames[:, IDX[s + a]] - c.frames[:, IDX[s + b]], axis=-1)
            assert np.allclose(la, lb, atol=1e-6)


def test_limit_knee_bend_opens_a_folded_knee_in_the_air():
    c = jump(g=9.81)
    f = c.frames.copy()
    mid = c.n // 2
    # fold the left knee to 172 degrees by hand on a mid-air frame
    j = body((0, 0.9, 0), bend_l=172, bend_r=10)
    j[:, 1] += f[mid, :, 1].max() - j[:, 1].max() + 0.0
    j[:, 2] += f[mid, IDX["Hips"], 2]
    f[mid] = j
    folded = c.copy(f)
    assert not hard(folded)["knees_within_range"]["ok"]
    fixed, n = repairs.limit_knee_bend(folded)
    assert n >= 1 and hard(fixed)["knees_within_range"]["ok"]


def test_bone_length_soft_rule_reports_a_stretched_bone():
    c = standing()
    f = c.frames.copy()
    f[5, IDX["LeftHand"]] += [0, -0.3, 0]
    r = gate.run_gate(c.copy(f))
    assert not r["soft"]["bones_keep_length"]["ok"]
    assert r["pass"]  # soft rules never block


def test_a_clip_marked_held_must_actually_be_held():
    # a long unsupported stretch (1.4 s at moon-like gravity) can't be excused by `supportedBy`
    c = jump(g=3.0, flight_frames=42).copy(supportedBy=["a wall"])
    assert not hard(c)["held_clips_are_held"]["ok"]
    short = jump(g=9.81, flight_frames=12).copy(supportedBy=["a wall"])
    assert hard(short)["held_clips_are_held"]["ok"]
    assert "held_clips_are_held" not in hard(jump())
