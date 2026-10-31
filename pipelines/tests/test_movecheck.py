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
    f[:, :, 1] -= f[:, :, 1].min(axis=1, keepdims=True)  # a rolling body always touches the ground
    return Clip(f, fps)


def test_a_full_forward_turn_is_a_roll():
    ok, nums, win = movecheck.roll_check(rolling(360))
    assert ok, nums
    assert nums["turn_in_window_deg"] > 280 and nums["upside_down"]


def test_a_front_flip_in_the_air_is_not_a_roll():
    c = rolling(360)
    f = c.frames.copy()
    k = np.sin(np.linspace(0, np.pi, len(f))) * 1.2  # the same turn, but thrown 1.2 m up
    f[:, :, 1] += k[:, None]
    ok, nums, _ = movecheck.roll_check(Clip(f, c.fps))
    assert not ok and (nums["peak_hips_vs_standing"] > 1.05 or nums["longest_air_s"] > 0.25)


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


def test_a_backward_somersault_is_not_a_forward_roll_even_after_orient():
    """orient() turns a clip so the hips travel along +z; a backward somersault must still read as backward."""
    from ccpipe import cmu
    c = rolling(-360)
    f = c.frames.copy()
    f[:, :, 2] *= -1  # a body facing -z that travels -z and turns backward over its back
    for k in range(len(f)):
        f[k, :, 0] *= -1  # keep it a proper (not mirrored) body
    oriented = Clip(cmu.orient(f), c.fps)
    assert not movecheck.roll_check(oriented)[0]


def test_a_roll_facing_the_other_way_still_passes():
    from ccpipe import cmu
    c = rolling(360)
    f = c.frames.copy()
    f[:, :, 2] *= -1
    f[:, :, 0] *= -1
    assert movecheck.roll_check(Clip(cmu.orient(f), c.fps))[0]


def test_a_clip_that_leans_only_at_its_last_frame_is_not_a_roll_and_does_not_crash():
    from synth import standing
    c = standing(30)
    f = c.frames.copy()
    f[-1, IDX["Neck1"], 2] += 0.6  # leans forward on the very last frame
    assert movecheck.roll_check(Clip(f, c.fps))[0] is False


def vaulting(hand_down=True, peak=0.45, travel=4.0, n=40, fps=30.0, airborne=(8, 26)):
    """A stick body that runs in, leaves the floor for `airborne` frames while the hips rise `peak` m and travel on, and lands upright.
    With `hand_down` one hand comes down low and ahead of the hips (on the obstacle)."""
    frames = []
    for i in range(n):
        p = i / (n - 1)
        a, b = airborne
        up = np.sin(np.pi * min(max((i - a) / (b - a), 0.0), 1.0)) if a <= i <= b else 0.0
        hip = np.array([0.0, 0.95 + peak * up, 2.0 * travel * p / 2])
        j = body((0, 0, 0))
        j -= j[IDX["Hips"]]
        j = j + hip
        if hand_down and a <= i <= b:
            j[IDX["RightHand"]] = hip + np.array([0.0, -0.3, 0.45])  # low and ahead of the hips
        if a <= i <= b:  # both feet off the floor
            j[IDX["LeftFoot"], 1] += 0.3 * up + 0.12
            j[IDX["RightFoot"], 1] += 0.3 * up + 0.12
        frames.append(j)
    f = np.array(frames)
    return Clip(f, fps)


def test_a_hop_with_a_hand_down_over_a_metre_is_a_vault():
    ok, nums, win = movecheck.vault_check(vaulting())
    assert ok, nums
    assert nums["hand_plant"] == "RightHand" and nums["travel_m"] >= 1.0


def test_a_hop_without_a_hand_on_the_obstacle_is_not_a_vault():
    ok, nums, _ = movecheck.vault_check(vaulting(hand_down=False))
    assert not ok and nums["hand_plant"] is None


def test_a_front_flip_is_not_a_vault():
    ok, nums, _ = movecheck.vault_check(vaulting(peak=1.5))
    assert not ok and nums["peak_hips_vs_standing"] > movecheck.VAULT_MAX_HIPS


def test_standing_still_is_not_a_vault():
    ok, nums, _ = movecheck.vault_check(vaulting(airborne=(100, 101)))
    assert not ok


def falling(turn_deg, down_to, n=90, fps=30.0):
    """A stick body that stands, turns `turn_deg` forward while its hips come down to `down_to` metres, and stays there."""
    frames = []
    for i in range(n):
        p = i / (n - 1)
        k = min(max((p - 0.1) / 0.3, 0.0), 1.0)  # the fall takes the first part, then it lies still
        ang = np.radians(turn_deg) * k
        hip = np.array([0.0, 0.9 + (down_to - 0.9) * k, 0.4 * k])
        j = body((0, 0, 0))
        j -= j[IDX["Hips"]]
        c, s = np.cos(ang), np.sin(ang)
        y, z = j[:, 1].copy(), j[:, 2].copy()
        j[:, 1], j[:, 2] = c * y - s * z, s * y + c * z
        frames.append(j + hip)
    f = np.array(frames)
    f[:, :, 1] -= np.minimum(f[:, :, 1].min(axis=1, keepdims=True), 0)  # nothing under the floor
    return Clip(f, fps)


def test_a_body_that_goes_down_and_stays_is_a_hard_fall():
    ok, nums, _ = movecheck.hurt_check(falling(85, 0.25))
    assert ok, nums
    assert nums["down_s"] >= 0.5 and nums["max_trunk_turn_deg"] >= 50


def test_a_stumble_that_recovers_is_not_a_hard_fall():
    ok, nums, _ = movecheck.hurt_check(falling(20, 0.8))
    assert not ok and nums["max_trunk_turn_deg"] < 50


def test_a_dip_that_comes_straight_back_up_is_not_a_hard_fall():
    c = falling(85, 0.25)
    f = c.frames.copy()
    f[20:] = f[0]  # back on its feet after the dip
    ok, nums, _ = movecheck.hurt_check(Clip(f, c.fps))
    assert not ok and nums["down_s"] < 0.5


def test_a_fall_onto_the_back_is_not_a_hard_landing():
    c = falling(85, 0.25)
    f = c.frames.copy()
    f[:, :, 2] = -f[:, :, 2] + 2 * f[:, IDX["Hips"], 2][:, None]  # the same fall, mirrored front to back
    ok, nums, _ = movecheck.hurt_check(Clip(f, c.fps))
    assert not ok and nums["forward_turn_deg"] < 50


def test_the_window_cuts_the_standing_lead_in():
    c = falling(85, 0.25, n=150)
    lead = np.repeat(c.frames[:1], 60, axis=0)  # two seconds of standing before the fall
    ok, nums, win = movecheck.hurt_check(Clip(np.concatenate([lead, c.frames]), c.fps))
    assert ok and win is not None and win[0] >= 55


# ---- the turn is measured along the line of travel (CC-227) ----

def _repo(*p):
    import os
    return os.path.join(os.path.dirname(__file__), "..", "..", *p)


def _spin(frames, deg):
    """Turn every joint about the vertical through the world origin."""
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    f = frames.copy()
    x, z = frames[:, :, 0].copy(), frames[:, :, 2].copy()
    f[:, :, 0], f[:, :, 2] = c * x + s * z, -s * x + c * z
    return f


def _shipped(name):
    import json
    return Clip.from_json(json.load(open(_repo("public", "assets", "motion", f"{name}.json"))))


def test_the_shipped_roll_still_passes_from_any_side():
    """A side view, a three-quarter view and a head-on view of the same roll are the same roll."""
    c = _shipped("roll")
    for deg in (0, 30, 90, 180, -60):
        ok, nums, _ = movecheck.roll_check(Clip(_spin(c.frames, deg), c.fps))
        assert ok, (deg, nums)


def test_the_shipped_non_rolls_still_fail():
    for name in ("vault", "climb", "hurt", "run", "leap", "land"):
        assert not movecheck.roll_check(_shipped(name))[0], name


def _head_on(offset=0.9, off_deg=40):
    """A roll along +z whose upper body leans sideways by `offset` m the whole way and whose hips start `off_deg` off square:
    what a body filmed head-on looks like to the check."""
    c = rolling(360)
    f = c.frames.copy()
    for n in ("Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head"):
        f[:, IDX[n], 0] += offset
    a = np.radians(off_deg)
    for n, sx in (("LeftLeg", 1), ("RightLeg", -1)):  # the start facing is read from the hip line
        f[:, IDX[n], 0] = f[:, IDX["Hips"], 0] + 0.1 * sx * np.cos(a)
        f[:, IDX[n], 2] = f[:, IDX["Hips"], 2] - 0.1 * sx * np.sin(a)
    return Clip(f, c.fps)


def test_a_roll_filmed_head_on_reads_a_full_turn_along_its_line_of_travel():
    c = _head_on()
    old = movecheck.trunk_pitch_deg(c.frames)               # the plane of the start facing
    new = movecheck.trunk_pitch_deg(c.frames, movecheck.roll_axis(c.frames))
    assert (old - old[0]).max() < 250, "the old reading is short on this body"
    assert (new - new[0]).max() > 330
    ok, nums, _ = movecheck.roll_check(c)
    assert ok, nums


def test_a_sideways_flip_is_not_a_roll():
    """Hips travel along +x while the trunk turns over in the x-y plane, the body started facing +z: a cartwheel or a side flip."""
    c = rolling(360)
    f = _spin(c.frames, 90)
    f[:, IDX["LeftLeg"]] = c.frames[:, IDX["LeftLeg"]]
    f[:, IDX["RightLeg"]] = c.frames[:, IDX["RightLeg"]]
    ok, nums, _ = movecheck.roll_check(Clip(f, c.fps))
    assert not ok, nums
    assert np.allclose(movecheck.roll_axis(f), movecheck.facing(f))


def test_a_clip_that_does_not_travel_uses_the_facing():
    from synth import standing
    f = standing(30).frames
    assert np.allclose(movecheck.roll_axis(f), movecheck.facing(f))


def test_the_head_on_london_parkour_jump_roll_turns_over_but_is_still_not_the_games_roll():
    """Real film (CC-222): the turn now reads about 390 degrees; the clip is a jump roll, so the hips rise and it stays in the air too long.
    The limits were not touched: it still fails, for those reasons."""
    import json
    m = json.load(open(_repo("data", "eval", "motion-from-you", "roll-lp", "motion.json")))
    from ccpipe import gate
    from ccpipe.skeleton import NAMES
    f = np.array(m["frames"])[:, [m["names"].index(n) for n in NAMES]]
    c = gate.clip_from_times(f, np.array(m["times"]))
    old = movecheck.trunk_pitch_deg(c.frames)
    assert (old - old[0]).max() < 150
    ok, nums, _ = movecheck.roll_check(c)
    assert nums["max_turn_deg"] > 330 and nums["upside_down"]
    assert not ok and (nums["peak_hips_vs_standing"] > movecheck.ROLL_MAX_HIPS or nums["longest_air_s"] > movecheck.ROLL_MAX_AIR_S)


def sliding(drop=0.75, travel=2.0, n=60, fps=30.0, legs_out=0.7):
    """A stick body that runs in upright, drops its hips by `drop` of their height, travels on while low, and stands up again.
    The legs are flattened onto the floor (no joint below it), so only the hips are judged."""
    frames = []
    for i in range(n):
        p = i / (n - 1)
        k = float(np.clip(min((p - 0.15) / 0.1, (0.85 - p) / 0.1), 0.0, 1.0))
        j = body((0, 0, 0))
        j -= j[IDX["Hips"]]
        j[:, 1] *= 1 - 0.8 * k  # the body folds down as the hips come down
        for name in ('LeftFoot', 'RightFoot', 'LeftShin', 'RightShin', 'LeftToeBase', 'RightToeBase'):
            j[IDX[name], 2] += legs_out * k  # the legs reach out in front
        hip = np.array([0.0, 0.9 * (1 - drop * k) + 0.06, travel * p])
        f = j + hip
        f[:, 1] = np.maximum(f[:, 1], 0.0)
        frames.append(f)
    return Clip(np.array(frames), fps)


def test_a_low_run_along_the_ground_is_a_slide():
    ok, nums, win = movecheck.slide_check(sliding())
    assert ok, nums
    assert win is not None and nums["low_s"] >= 0.3


def test_a_crouch_with_the_feet_under_the_body_is_not_a_slide():
    ok, nums, _ = movecheck.slide_check(sliding(legs_out=0.0))
    assert not ok and nums["foot_ahead_m"] < 0.3


def test_a_slide_clip_need_not_travel_because_the_game_carries_the_body():
    ok, nums, _ = movecheck.slide_check(sliding(travel=0.0))
    assert ok, nums


def test_a_small_dip_is_not_a_slide():
    ok, nums, win = movecheck.slide_check(sliding(drop=0.2))
    assert not ok and win is None


def test_a_roll_is_not_a_slide():
    ok, nums, _ = movecheck.slide_check(rolling(360, travel=2.5))
    assert not ok


def test_standing_is_not_a_slide():
    from synth import standing
    ok, nums, win = movecheck.slide_check(standing(60, speed=2.0))
    assert not ok and win is None
