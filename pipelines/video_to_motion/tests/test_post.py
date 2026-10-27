"""The CPU half of video to motion uses the shared gate and the shared repairs."""
from ccpipe import gate
import post
from synth import standing


def test_repair_frames_lifts_sunk_feet_and_the_shared_gate_passes_them():
    c = standing()
    sunk = c.frames.copy()
    sunk[:, :, 1] -= 0.05
    assert not gate.run_gate_times(sunk, c.times)["pass"]
    fixed = post.repair_frames(sunk, c.times)
    assert gate.run_gate_times(fixed, c.times)["pass"]


def test_repair_frames_fixes_a_backwards_knee():
    c = standing(bend_l=70, bend_r=70, backwards=True)
    assert not gate.run_gate_times(c.frames, c.times)["hard"]["knees_bend_forward"]["ok"]
    fixed = post.repair_frames(c.frames, c.times)
    assert gate.run_gate_times(fixed, c.times)["hard"]["knees_bend_forward"]["ok"]


def test_athlete_segment_ignores_a_small_far_bystander():
    meas = [{"ok": True, "bbox": [0, 0, 50, 300]}] * 10 + [{"ok": True, "bbox": [0, 0, 20, 60]}] * 5
    assert post.athlete_segment(meas) == (0, 10)


def test_regate_picks_joints_by_name_so_old_joint_orders_still_work(tmp_path):
    import json
    import regate
    c = standing()
    order = list(reversed(range(30)))      # a file written with the joints in another order
    from ccpipe.skeleton import NAMES
    path = tmp_path / "motion.json"
    path.write_text(json.dumps({"names": [NAMES[i] for i in order], "times": c.times.tolist(),
                                "frames": c.frames[:, order].tolist()}))
    assert regate.regate(path)["verdict"] == "PASS"
