"""The gate on measured video: arrays with the video's own times and a floor (the old video_to_motion gate's cases)."""
import numpy as np

from ccpipe import gate
from ccpipe.clip import Clip
from ccpipe.skeleton import IDX
from synth import jump, standing


def test_one_gate_for_clips_and_video_arrays():
    c = standing(speed=0.0)
    assert gate.run_gate_times(c.frames, c.times)["hard"].keys() == gate.run_gate(c)["hard"].keys()


def test_free_fall_passes_and_wrong_gravity_fails():
    for g, ok in ((9.81, True), (5.0, False)):
        c = jump(g=g, flight_frames=18)
        r = gate.run_gate_times(c.frames, c.times)
        assert r["hard"]["flight_is_ballistic"]["ok"] == ok, r["hard"]["flight_is_ballistic"]


def test_floor_is_the_zero_of_height():
    c = standing()
    lifted = c.frames.copy()
    lifted[:, :, 1] += 0.5       # a floor measured half a metre up
    assert gate.run_gate_times(lifted, c.times, floor=0.5)["pass"]
    assert not gate.run_gate_times(lifted - [0, 0.6, 0], c.times, floor=0.0)["hard"]["feet_dont_sink"]["ok"]


def test_even_times_are_not_resampled_and_uneven_times_are():
    c = jump(g=9.81)
    same = gate.clip_from_times(c.frames, c.times)
    assert np.allclose(same.frames, c.frames) and abs(same.fps - c.fps) < 1e-9
    t = c.times.copy()
    t[1:-1] += 0.3 / c.fps * np.sin(np.arange(1, c.n - 1))    # up to 0.3 frame of timing wobble
    wobbly = gate.clip_from_times(c.frames, t)
    assert wobbly.n == c.n and not np.allclose(wobbly.frames, c.frames)


def test_supported_by_and_gravity_reach_the_rules():
    c = jump(g=5.0)
    assert not gate.run_gate_times(c.frames, c.times)["hard"]["flight_is_ballistic"]["ok"]
    assert gate.run_gate_times(c.frames, c.times, gravity=5.0)["hard"]["flight_is_ballistic"]["ok"]
    held = gate.run_gate_times(c.frames, c.times, supported_by="a wall")["hard"]
    assert held["flight_is_ballistic"]["ok"] and "held_clips_are_held" in held
