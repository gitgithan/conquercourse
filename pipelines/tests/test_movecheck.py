"""Move checks on synthetic bodies: a body turned through a full forward circle is a roll; a stumble is not (CC-64)."""
import numpy as np

from ccpipe import movecheck
from ccpipe.clip import Clip
from ccpipe.skeleton import IDX
from synth import body


def rolling(turn_deg, n=60, fps=30.0, travel=1.5):
    """A stick body that runs in upright, turns `turn_deg` forward about its middle, and ends up upright again."""
    frames = []
    for i in range(n):
        p = i / (n - 1)
        # upright for the first and last tenth, turning in between
        k = min(max((p - 0.1) / 0.8, 0.0), 1.0)
        ang = np.radians(turn_deg) * k
        hip = np.array([0.0, 0.9 - 0.4 * np.sin(np.pi * k), travel * p])
        j = body((0, 0, 0))
        j -= j[IDX["Hips"]]
        c, s = np.cos(ang), np.sin(ang)
        # forward turn: the head (up, +y) goes toward +z
        y, z = j[:, 1].copy(), j[:, 2].copy()
        j[:, 1], j[:, 2] = c * y - s * z, s * y + c * z
        frames.append(j + hip)
    f = np.array(frames)
    f[:, :, 1] -= f[:, :, 1].min()
    return Clip(f, fps)


def test_a_full_forward_turn_is_a_roll():
    ok, nums, win = movecheck.roll_check(rolling(360))
    assert ok, nums
    assert nums["turn_in_window_deg"] > 280 and nums["upside_down"]


def test_a_half_turn_is_not_a_roll():
    ok, nums, _ = movecheck.roll_check(rolling(150))
    assert not ok and nums["max_turn_deg"] < 200


def test_a_backward_turn_is_not_a_forward_roll():
    ok, nums, _ = movecheck.roll_check(rolling(-360))
    assert not ok


def test_standing_is_not_a_roll():
    from synth import standing
    ok, nums, win = movecheck.roll_check(standing(60, speed=2.0))
    assert not ok and win is None


def test_trim_keeps_the_window_with_run_in_and_get_up():
    c = rolling(360, n=90)
    ok, nums, win = movecheck.roll_check(c)
    t = movecheck.trim(c, win, pad_s=0.25)
    assert t.n < c.n and t.n >= win[1] - win[0]
    assert abs(float(t.frames[0, IDX["Hips"], 2])) < 1e-9


def test_search_cmu_finds_terms_and_skips_phrases():
    index = [{"id": "90_01", "subject": 90, "subjectDesc": "x", "desc": "bkwd summersult", "fps": 120},
             {"id": "90_34", "subject": 90, "subjectDesc": "x", "desc": "wide leg roll", "fps": 120},
             {"id": "02_01", "subject": 2, "subjectDesc": "walk", "desc": "walk", "fps": 120}]
    hits = movecheck.search_cmu(index, ["roll", "summersult"], ["wide leg roll"])
    assert [h["id"] for h in hits] == ["90_01"]
