"""The wall geometry and the targets built from the simulator's wall run (CC-17)."""
import json
import os

import numpy as np

from ccpipe import wall_geom as W

SIM = os.path.join(os.path.dirname(__file__), "..", "..", "data", "eval", "cc-17-wall", "inputs", "sim_path.json")


def test_curve_is_a_quarter_circle():
    w = W.Wall(4.3)
    assert abs(float(w.surface_y(0))) < 1e-9
    assert abs(float(w.surface_y(4.3)) - 4.3) < 1e-9
    z = 2.0
    assert abs(np.hypot(z, w.surface_y(z) - 4.3) - 4.3) < 1e-9


def test_sdf_sign_and_push_out():
    w = W.Wall(4.3)
    air = np.array([[0, 3.3, 3.8], [0, 5.0, 4.0], [0, 4.5, 4.5], [0, 0.5, -1.0]])
    solid = np.array([[0, 1.0, 4.2], [0, 2.0, 5.0], [0, 0.0, 2.0]])
    assert (w.sdf(air) > 0).all() and (w.sdf(solid) < 0).all()
    out = w.push_out(solid, 0.05)
    assert (w.sdf(out) >= 0.05 - 1e-3).all()
    assert np.allclose(w.push_out(air, 0.0), air)


def test_normal_points_into_the_air():
    w = W.Wall(4.3)
    p, n = w.curve_point(3.0)
    assert w.sdf(p + n * 0.1) > 0.09 and abs(float(w.sdf(p))) < 1e-9


def test_the_simulators_grab_tick_is_out_of_a_bodys_reach_and_the_apex_one_is_not():
    t = W.load_targets(SIM)
    assert t["hips_to_wrist_at_sim_grab_tick"] > W.MAX_ARM + 1.0
    assert t["hips_to_wrist_at_grab"] <= W.GRIP_REACH
    assert t["frames"] == 90 and len(t["hips"]) == 90


def test_planted_feet_are_within_a_legs_reach_for_the_whole_plant():
    t = W.load_targets(SIM)
    hips = np.array(t["hips"])
    for p in t["plants"]:
        a, b = p["frames"]
        d = np.linalg.norm(hips[a:b + 1] - np.array(p["point"]), axis=1)
        assert d.max() <= W.PLANT_REACH[1] + 1e-6 and d.min() >= W.PLANT_REACH[0] - 1e-6
        assert W.Wall().sdf(np.array(p["sole"])) < 1e-6        # the sole is on the curve


def test_hips_path_follows_the_simulator_within_the_drop():
    t = W.load_targets(SIM)
    assert np.allclose(np.array(t["sim_hips"])[:, 1] - np.array(t["hips"])[:, 1], W.HIPS_DROP)
    sp = np.linalg.norm(np.diff(np.array(t["sim_hips"])[:, [1, 2]], axis=0), axis=1) * W.FPS
    assert sp.max() < 8.0          # no teleport: the fastest the hips move is the mantle's 5.5 m/s or the 7 m/s sprint
