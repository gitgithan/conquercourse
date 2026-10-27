"""Targets, scoring and the join of the two-stage wall climb on synthetic data (CC-36)."""
import json
import os

import numpy as np

from ccpipe import wall_stages as ws
from ccpipe.skeleton import IDX, PARENTS
from ccpipe.wall_geom import Wall
from synth import standing

SIM = os.path.join(os.path.dirname(__file__), "..", "..", "data", "eval", "cc-17-wall", "inputs", "sim_path.json")
REPORT = {"pass": True, "hard": {}, "soft": {}}


def sim():
    with open(SIM) as f:
        return json.load(f)


def test_stage_a_hips_follow_the_simulators_feet_path_and_rise_under_2_5_m():
    t = ws.build_targets_a(sim())
    h = np.array(t["sim_hips"])
    assert len(h) == 60 and h[0, 1] == 1.0
    assert 2.1 < t["hips_rise"] < 2.5
    assert abs(h[-1, 2] - 3.75) < 0.08 and abs(h[-1, 1] - 3.23) < 0.05      # feet 2.2 m up the curve
    assert [p["joint"] for p in t["plants"]] == ["RightFoot", "LeftFoot"]
    assert all(p["frames"][1] <= 59 for p in t["plants"] + t["grips"])
    assert t["hips_to_edge_wrist_at_end"] > 1.07                              # still out of reach: the arms only start to rise


def test_stage_a_plants_lie_on_the_curve():
    w = Wall()
    for p in ws.build_targets_a(sim())["plants"]:
        assert 0.07 < float(w.sdf(np.array(p["point"]))) < 0.09 and p["point"][1] >= 0.4


def test_stage_b_is_local_to_the_ledge_and_rises_about_2_m():
    t = ws.build_targets_b()
    h = np.array(t["hips"])
    assert t["world_shift"] == [0.0, 2.2, 4.3] and len(h) == 48
    assert np.allclose(h[0], h[ws.B_HOLD - 1]) and abs(h[0, 1] - 1.1) < 1e-9       # hanging, hips 1.0 m under the 2.1 m ledge
    assert abs(h[-1, 1] - 3.1) < 1e-9 and abs(h[-1, 2] - 0.4) < 1e-9
    assert 1.9 < t["hips_rise"] < 2.1 and t["hips_to_wrist_at_hang"] <= 1.07
    assert max(np.abs(np.diff(h[:, 1])).max(), 0) * 30 < 12                         # no teleport
    w = ws.world_targets_b(t)
    assert abs(w["grips"][0]["point"][1] - 4.28) < 1e-9 and abs(w["deck"][0]["point"][1] - 4.38) < 1e-9


def _pose_at(hip, frames=48):
    return np.repeat(standing(n=1).frames[:1], frames, axis=0) + (np.array(hip) - standing(n=1).frames[0, 0])


def test_stage_a_score_flags_a_hips_error_and_a_body_in_the_wall():
    t = ws.build_targets_a(sim())
    f = np.array(t["sim_hips"])[:, None, :] + (standing(n=1).frames[0] - standing(n=1).frames[0, 0])[None]
    s = ws.evaluate_a(f, t, Wall(), REPORT)
    assert s["lines"]["2_hips_on_path"]["ok"] and s["lines"]["6_shape"]["ok"]
    f2 = f.copy()
    f2[30:, :, 1] += 0.2
    assert not ws.evaluate_a(f2, t, Wall(), REPORT)["lines"]["2_hips_on_path"]["ok"]
    f3 = f.copy()
    f3[-1, :, 2] += 0.5                                                      # a body pushed into the curve at the end
    f3[-1, :, 1] -= 0.8
    assert not ws.evaluate_a(f3, t, Wall(), REPORT)["lines"]["5_wall"]["ok"]


def test_stage_b_score_needs_the_hang_then_the_stand():
    w, tb = Wall(), ws.build_targets_b()
    tw = ws.world_targets_b(tb)
    f = np.array(tw["hips"])[:, None, :] + (standing(n=1).frames[0] - standing(n=1).frames[0, 0])[None]
    # put the wrists on the ledge for the hang and the ankles on the deck for the stand
    for g in tw["grips"]:
        f[: ws.B_GRIP_LAST + 1, IDX[g["joint"]]] = g["point"]
    for g in tw["deck"]:
        f[ws.B_DECK_FIRST:, IDX[g["joint"]]] = g["point"]
    s = ws.evaluate_b(f, tw, w, REPORT)
    assert s["lines"]["2_hang"]["ok"] and s["lines"]["3_pull_up"]["ok"] and s["lines"]["5_shape"]["ok"] and s["lines"]["6_rise"]["ok"], s["lines"]
    g = f.copy()
    g[:, IDX["LeftHand"], 2] -= 0.2                                          # one hand off the ledge
    assert not ws.evaluate_b(g, tw, w, REPORT)["lines"]["2_hang"]["ok"]
    h = f.copy()
    h[-5:, :, 1] -= 0.5                                                      # hips sink back under the deck
    assert not ws.evaluate_b(h, tw, w, REPORT)["lines"]["3_pull_up"]["ok"]


def test_join_keeps_bone_lengths_between_the_two_poses_and_both_ends_untouched():
    a = _pose_at([0, 3.2, 3.75], 6)
    b = _pose_at([0, 3.3, 4.05], 6)
    out = ws.join(a, b, blend=10)
    assert out.shape == (6 + 10 + 6, 30, 3)
    assert np.allclose(out[:6], a) and np.allclose(out[16:], b)
    for t in range(6, 16):
        for j in range(1, 30):
            la = np.linalg.norm(a[0, j] - a[0, PARENTS[j]])
            assert abs(np.linalg.norm(out[t, j] - out[t, PARENTS[j]]) - la) < 1e-6
    assert np.all(np.diff(out[5:17, 0, 2]) > 0)                              # the hips move steadily toward B


def test_lowered_targets_keep_the_world_path_and_drop_every_height():
    t = ws.build_targets_a(sim())
    lo = ws.lowered(t, 0.7)
    assert lo["model_shift_y"] == 0.7 and lo["sim_hips"] == t["sim_hips"]
    assert np.allclose(np.array(lo["hips"])[:, 1], np.array(t["hips"])[:, 1] - 0.7)
    assert np.isclose(lo["plants"][0]["point"][1], t["plants"][0]["point"][1] - 0.7)
    back = ws.lowered(lo, -0.7)
    assert np.allclose(back["hips"], t["hips"], atol=1e-3)
