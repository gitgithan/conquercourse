import json
from pathlib import Path

import numpy as np

from ccpipe import gate, primitives as P, recipe as R
from ccpipe.skeleton import NAMES
from synth import jump, standing

ROOT = Path(__file__).resolve().parents[2]
BRICK = ROOT / "data/eval/cc-26-pexels-motion/Over_a_brick_wall_vault_or_wall_move"


def contact(joint, a, b, point, fps=30.0, kind="obstacle"):
    return {"joint": joint, "frames": [a, b], "t": [a / fps, b / fps], "point": point, "kind": kind}


def wall_prim(h=2.0):
    return P.fit({"phrase": "wall", "box": [0, 0, 60, 400], "score": 0.9, "frames": [0]}, P.scale_known_height(h, 400), 400)


def wall_run_contacts():
    return [contact("RightFoot", 12, 15, [0, 0.9, 3.0]), contact("LeftHand", 18, 40, [0.1, 2.0, 3.2]),
            contact("LeftFoot", 18, 22, [0, 1.4, 3.1]), contact("RightFoot", 50, 56, [0, 0.0, 4.5], kind="ground")]


def test_phases_follow_the_order_of_contacts():
    c = jump(speed=5.0, flight_frames=30, lead=12, tail=20)
    ph = R.detect_phases(c.frames, c.times, wall_run_contacts())
    assert [p["name"] for p in ph] == ["run-up", "plant", "grip", "release", "landing"]
    assert ph[0]["frames"] == [0, 12] and ph[1]["frames"][0] == 12


def test_recipe_holds_height_fractions_timing_and_provenance():
    c = jump(speed=5.0, flight_frames=30, lead=12, tail=20)
    g = gate.run_gate(c)
    r = R.build_recipe(c.frames, c.times, wall_run_contacts(), wall_prim(2.0), {"id": "t"}, g)
    assert r["move"] == "wall-run-and-grab"
    hand = next(e for e in r["contactEvents"] if e["joint"] == "LeftHand")
    assert abs(hand["height_frac"] - 1.0) < 0.01 and hand["on"] == "wall" and hand["phase"] == "grip"
    assert 4.0 < r["timing"]["approach_speed_mps"] < 6.0 and r["timing"]["plant_to_grip_s"] > 0
    assert r["provenance"]["transfer"].startswith("guess") and all(t["confidence"] == "guess" for t in r["transfer"])
    json.dumps(r)


def test_a_failed_gate_is_written_into_the_recipe():
    c = jump(g=5.0, flight_frames=18)
    g = gate.run_gate(c)
    assert not g["pass"]
    r = R.build_recipe(c.frames, c.times, wall_run_contacts(), wall_prim(), {"id": "t"}, g)
    assert r["gate"]["verdict"] == "FAIL" and r["warnings"]


def test_fit_to_known_obstacles_checks_type_ratio_reach_and_gate():
    c = jump(speed=5.0, flight_frames=30, lead=12, tail=20)
    r = R.build_recipe(c.frames, c.times, wall_run_contacts(), wall_prim(2.0), {"id": "t"}, gate.run_gate(c))
    r["gate"]["verdict"] = "PASS"
    r["reach"]["highest_hand_m"] = 1.5
    short = R.fit_to(r, wall_prim(2.2))
    assert short["height_scale"] == 1.1 and not short["ok"] and any("does not cover" in x for x in short["reasons"])
    r["reach"]["highest_hand_m"] = 2.4
    assert R.fit_to(r, wall_prim(2.2))["ok"]
    far = R.fit_to(r, wall_prim(4.0))
    assert not far["ok"] and any("ratio" in x for x in far["reasons"])
    bar = P.fit({"phrase": "bar", "box": [0, 0, 300, 10], "frames": [0]}, P.scale_known_height(2.0, 400), 400)
    assert any("no transfer" in x for x in R.fit_to(r, bar)["reasons"])
    r["gate"]["verdict"] = "FAIL"
    assert any("failed the gate" in x for x in R.fit_to(r, wall_prim(2.2))["reasons"])


def test_a_standing_clip_without_obstacle_contacts_gives_no_phases():
    c = standing()
    assert R.detect_phases(c.frames, c.times, []) == []


def test_recipe_from_the_real_brick_wall_clip_is_serialisable_and_marked_failed():
    m = json.loads((BRICK / "motion.json").read_text())
    frames = np.array(m["frames"])[:, [m["names"].index(n) for n in NAMES]]
    cs = json.loads((BRICK / "contacts.json").read_text())
    g = gate.run_gate_times(frames, m["times"], supported_by="a brick wall")
    r = R.build_recipe(frames, m["times"], cs, wall_prim(2.0), {"id": "brick"}, g)
    json.dumps(r)
    assert r["gate"]["verdict"] == "FAIL" and r["phases"] and r["contactEvents"]
