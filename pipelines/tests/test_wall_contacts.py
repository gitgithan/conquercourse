"""Contact IK and wall push-out on synthetic bodies (CC-17)."""
import numpy as np

from ccpipe import wall_contacts as wc
from ccpipe.skeleton import IDX
from ccpipe.wall_geom import Wall
from synth import standing


def body(n=20):
    return standing(n=n).frames.copy()


def test_two_bone_reaches_a_point_in_reach_and_keeps_lengths():
    root, mid, end = np.array([0, 1, 0.0]), np.array([0, 0.6, 0.1]), np.array([0, 0.2, 0.0])
    l1, l2 = np.linalg.norm(mid - root), np.linalg.norm(end - mid)
    target = np.array([0.1, 0.4, 0.3])
    m, e, short = wc.two_bone(root, mid, end, target, l1, l2)
    assert np.linalg.norm(e - target) < 1e-9 and short == 0
    assert abs(np.linalg.norm(m - root) - l1) < 1e-9 and abs(np.linalg.norm(e - m) - l2) < 1e-9


def test_two_bone_out_of_reach_stops_at_full_stretch_and_reports_the_rest():
    root, mid, end = np.array([0, 1, 0.0]), np.array([0, 0.6, 0.1]), np.array([0, 0.2, 0.0])
    l1, l2 = np.linalg.norm(mid - root), np.linalg.norm(end - mid)
    m, e, short = wc.two_bone(root, mid, end, np.array([0, 1, 5.0]), l1, l2)
    assert abs(np.linalg.norm(e - root) - (l1 + l2)) < 1e-3 and abs(short - (5 - (l1 + l2))) < 1e-3


def test_contact_ik_puts_the_foot_on_the_target_and_eases_in_and_out():
    f = body()
    tgt = f[0, IDX["LeftFoot"]] + [0.05, 0.1, 0.1]
    out, left = wc.contact_ik(f, [{"joint": "LeftFoot", "frames": [8, 12], "point": tgt.tolist()}])
    assert left[0] < 1e-6
    for t in range(8, 13):
        assert np.linalg.norm(out[t, IDX["LeftFoot"]] - tgt) < 1e-6
    assert np.allclose(out[0], f[0]) and np.allclose(out[19], f[19])      # outside the blend nothing moves
    d = [np.linalg.norm(out[t, IDX["LeftFoot"]] - tgt) for t in range(3, 9)]
    assert all(a >= b - 1e-9 for a, b in zip(d, d[1:]))                    # the ease is monotone


def test_push_out_takes_a_foot_out_of_the_wall_and_keeps_bone_lengths():
    w = Wall(4.3)
    f = body()
    f[:, :, 2] += (4.15 - f[:, 0, 2])[:, None]          # the hips in the air above the curve, the legs down in the wall
    f[:, :, 1] += (3.4 - f[:, 0, 1])[:, None]
    assert wc.inside_wall(f, w).max() > 0.05
    out = wc.push_out(f, w, margin=0.02)
    assert wc.inside_wall(out, w).max() <= 0.0 + 1e-6
    from ccpipe.skeleton import PARENTS
    for j in range(1, 30):
        assert abs(np.linalg.norm(out[3, j] - out[3, PARENTS[j]]) - np.linalg.norm(f[3, j] - f[3, PARENTS[j]])) < 1e-6
