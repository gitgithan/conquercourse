"""Key poses for hang, swing and vault as the 30 SOMA joints (CC-54).

A pose is hand-set directions for each limb (body frame: x left, y up, z forward) with the bone lengths of the CMU hang clip,
so every bone keeps its length. No capture data and no person's picture is used."""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ccpipe.skeleton import IDX, N_JOINTS  # noqa: E402

LEN = {"spine": 0.116, "neck1": 0.099, "neck2": 0.05, "head": 0.05, "shoulder": 0.09, "upper_arm": 0.281, "forearm": 0.197,
       "hip": 0.10, "thigh": 0.404, "shin": 0.423, "toe": 0.134}


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def build(torso, arm_l, fore_l, arm_r, fore_r, leg_l, shin_l, leg_r, shin_r, foot=(0, -0.15, 1)):
    """Joint positions with the hips at the origin. `torso` is the direction the spine points; the others are bone directions."""
    p = np.zeros((N_JOINTS, 3))
    t = unit(torso)
    for a, b, n in [("Hips", "Spine1", "spine"), ("Spine1", "Spine2", "spine"), ("Spine2", "Chest", "spine"), ("Chest", "Neck1", "neck1"),
                    ("Neck1", "Neck2", "neck2"), ("Neck2", "Head", "head")]:
        p[IDX[b]] = p[IDX[a]] + t * LEN[n]
    # the shoulder line is sideways (x) and level, so the pose faces +z whatever the lean
    for sgn, S in ((1, "Left"), (-1, "Right")):
        sh = p[IDX["Chest"]] + np.array([sgn * LEN["shoulder"], 0, 0])
        p[IDX[f"{S}Shoulder"]] = sh
        arm = p[IDX[f"{S}Arm"]] = sh + np.array([sgn * LEN["shoulder"], 0, 0])
    for S, ua, fa in (("Left", arm_l, fore_l), ("Right", arm_r, fore_r)):
        el = p[IDX[f"{S}ForeArm"]] = p[IDX[f"{S}Arm"]] + unit(ua) * LEN["upper_arm"]
        hand = p[IDX[f"{S}Hand"]] = el + unit(fa) * LEN["forearm"]
        p[IDX[f"{S}HandThumbEnd"]] = hand + unit(fa) * 0.08
        p[IDX[f"{S}HandMiddleEnd"]] = hand + unit(fa) * 0.1
    for sgn, S, th, sh in ((1, "Left", leg_l, shin_l), (-1, "Right", leg_r, shin_r)):
        hip = p[IDX[f"{S}Leg"]] = np.array([sgn * LEN["hip"], -0.05, 0])
        knee = p[IDX[f"{S}Shin"]] = hip + unit(th) * LEN["thigh"]
        ankle = p[IDX[f"{S}Foot"]] = knee + unit(sh) * LEN["shin"]
        p[IDX[f"{S}ToeBase"]] = ankle + unit(foot) * LEN["toe"]
    head = p[IDX["Head"]]
    p[IDX["Jaw"]] = head + np.array([0, -0.05, 0.08])
    p[IDX["LeftEye"]] = head + np.array([0.03, 0.03, 0.09])
    p[IDX["RightEye"]] = head + np.array([-0.03, 0.03, 0.09])
    return p


def hang_pose(bar_y=2.1, bar_z=0.0):
    """Hanging straight by two hands on a bar, a little bend at the knees, feet slightly forward."""
    p = build(torso=(0, 1, 0.03), arm_l=(0.16, 1, 0.05), fore_l=(0.12, 1, 0.02), arm_r=(-0.16, 1, 0.05), fore_r=(-0.12, 1, 0.02),
              leg_l=(0.03, -1, 0.08), shin_l=(0, -1, -0.2), leg_r=(-0.03, -1, 0.08), shin_r=(0, -1, -0.2))
    hands = (p[IDX["LeftHand"]] + p[IDX["RightHand"]]) / 2
    return p + np.array([0, bar_y, bar_z]) - hands  # the hands' middle sits on the bar


def swing_pose(phi, bar_y=2.1, bar_z=0.0):
    """The hanging pose swung about the bar by phi radians (positive: the feet go forward, +z)."""
    p = hang_pose(bar_y, bar_z)
    bar = np.array([0, bar_y, bar_z])
    d = p - bar
    out = np.empty_like(p)
    c, s = np.cos(phi), np.sin(phi)
    out[:, 0] = d[:, 0]
    out[:, 1] = d[:, 1] * c + d[:, 2] * s
    out[:, 2] = d[:, 2] * c - d[:, 1] * s
    return out + bar


def vault_pose(box_y=1.0):
    """A speed vault over a box, mid-way: the right hand on top, the body leaning over it, both legs swung out to the left."""
    p = build(torso=(0.15, 1, 0.55), arm_l=(0.3, -0.2, 1), fore_l=(0.2, -0.3, 1), arm_r=(-0.1, -0.6, 0.8), fore_r=(0, -1, 0.3),
              leg_l=(0.9, -0.25, 0.25), shin_l=(0.55, -0.85, -0.1), leg_r=(0.85, -0.35, 0.2), shin_r=(0.5, -0.85, -0.2), foot=(0.3, -0.3, 0.9))
    rh = p[IDX["RightHand"]]
    return p + np.array([0, box_y, 0]) - rh + np.array([0, 0, 0.0])


def all_poses():
    return {"hang": hang_pose(), "swing_front": swing_pose(0.5), "swing_back": swing_pose(-0.5), "vault": vault_pose()}


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "..", "data", "eval", "pose-kimodo", "inputs")
    os.makedirs(out, exist_ok=True)
    poses = {k: np.round(v, 4).tolist() for k, v in all_poses().items()}
    with open(os.path.join(out, "key_poses.json"), "w") as f:
        json.dump({"note": "hand-set key poses, SOMA 30 joints, metres, y up, +z forward, +x left; hips at the origin before placing", "poses": poses}, f, indent=2)
    print({k: np.round(v[IDX["Hips"]], 2).tolist() for k, v in all_poses().items()})
