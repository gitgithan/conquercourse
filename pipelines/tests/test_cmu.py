import numpy as np

from ccpipe import cmu
from ccpipe.skeleton import IDX, NAMES, PARENTS

ASF = """:version 1.10
:name test
:units
  length 0.45
:root
   order TX TY TZ RX RY RZ
:bonedata
  begin
     name lfemur
     direction 0 -1 0
     length 10
     axis 0 0 0 XYZ
     dof rx ry rz
  end
  begin
     name ltibia
     direction 0 -1 0
     length 10
     axis 0 0 0 XYZ
     dof rx
  end
:hierarchy
  begin
    root lfemur
    lfemur ltibia
  end
"""


def test_forward_kinematics_straight_leg_and_units():
    bones, children = cmu.parse_asf(ASF)
    frames = [{"root": [0, 0, 0, 0, 0, 0], "lfemur": [0, 0, 0], "ltibia": [0]}]
    fk = cmu.forward_kinematics(bones, children, frames)
    assert np.allclose(fk["ltibia"][0][0], [0, -10 * cmu.METRES_PER_ASF_UNIT, 0])
    assert np.allclose(fk["ltibia"][1][0], [0, -20 * cmu.METRES_PER_ASF_UNIT, 0])


def test_forward_kinematics_bends_knee_about_x():
    bones, children = cmu.parse_asf(ASF)
    frames = [{"root": [0, 0, 0, 0, 0, 0], "lfemur": [0, 0, 0], "ltibia": [90]}]
    end = cmu.forward_kinematics(bones, children, frames)["ltibia"][1][0]
    # a +90 degree turn about x swings a downward bone to -z or +z, level with the knee
    assert abs(end[1] - (-10 * cmu.METRES_PER_ASF_UNIT)) < 1e-9
    assert abs(abs(end[2]) - 10 * cmu.METRES_PER_ASF_UNIT) < 1e-9


def test_downsample_requires_exact_division():
    j = np.zeros((10, 30, 3))
    assert cmu.downsample_frames(j, 120).shape[0] == 3
    try:
        cmu.downsample_frames(j, 100)
    except AssertionError:
        return
    raise AssertionError("100 -> 30 must be refused")


def test_orient_runs_along_plus_z_and_stands_on_floor():
    f = np.zeros((20, 30, 3))
    f[:, IDX["LeftLeg"]] = [0.1, 0.9, 0]
    f[:, IDX["RightLeg"]] = [-0.1, 0.9, 0]
    f[:, IDX["Hips"], 1] = 1.0
    f[:, :, 1] += 5
    for t in range(20):  # travel along +x
        f[t, :, 0] += 0.2 * t + 3
    out = cmu.orient(f)
    hips = out[:, IDX["Hips"]]
    assert hips[0, 0] == 0 and hips[0, 2] == 0
    assert hips[-1, 2] > 3 and abs(hips[-1, 0]) < 1e-9
    assert out[:, :, 1].min() == 0
