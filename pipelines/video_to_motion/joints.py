"""The 30 joints (Kimodo's SOMA model skeleton) and small helpers."""
import numpy as np

BASE = ["Hips", "Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head", "Jaw", "LeftEye", "RightEye"]
SIDE = ["Shoulder", "Arm", "ForeArm", "Hand", "HandThumbEnd", "HandMiddleEnd", "Leg", "Shin", "Foot", "ToeBase"]
NAMES = BASE + [s + j for s in ("Left", "Right") for j in SIDE]
PARENTS_BY_NAME = {
    "Hips": None, "Spine1": "Hips", "Spine2": "Spine1", "Chest": "Spine2", "Neck1": "Chest", "Neck2": "Neck1",
    "Head": "Neck2", "Jaw": "Head", "LeftEye": "Head", "RightEye": "Head",
}
for _s in ("Left", "Right"):
    PARENTS_BY_NAME.update({
        _s + "Shoulder": "Chest", _s + "Arm": _s + "Shoulder", _s + "ForeArm": _s + "Arm", _s + "Hand": _s + "ForeArm",
        _s + "HandThumbEnd": _s + "Hand", _s + "HandMiddleEnd": _s + "Hand", _s + "Leg": "Hips",
        _s + "Shin": _s + "Leg", _s + "Foot": _s + "Shin", _s + "ToeBase": _s + "Foot"})
PARENTS = [-1 if PARENTS_BY_NAME[n] is None else NAMES.index(PARENTS_BY_NAME[n]) for n in NAMES]
IDX = {n: i for i, n in enumerate(NAMES)}
assert len(NAMES) == 30


def j(a, name):
    """a: (T,30,3) -> (T,3) for joint name"""
    return a[:, IDX[name]]


def speeds(p, times):
    """per-frame speed (m/s) of a (T,3) track, central differences on the clip's own times"""
    t = np.asarray(times)
    v = np.gradient(p, t, axis=0)
    return np.linalg.norm(v, axis=1)
