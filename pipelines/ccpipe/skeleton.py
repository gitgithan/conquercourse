"""The 30 joints Kimodo uses as its model skeleton (NVIDIA SOMA)."""

NAMES = [
    "Hips", "Spine1", "Spine2", "Chest", "Neck1", "Neck2", "Head", "Jaw", "LeftEye", "RightEye",
    "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftHandThumbEnd", "LeftHandMiddleEnd",
    "RightShoulder", "RightArm", "RightForeArm", "RightHand", "RightHandThumbEnd", "RightHandMiddleEnd",
    "LeftLeg", "LeftShin", "LeftFoot", "LeftToeBase",
    "RightLeg", "RightShin", "RightFoot", "RightToeBase",
]
_PARENT_NAMES = {
    "Hips": None, "Spine1": "Hips", "Spine2": "Spine1", "Chest": "Spine2", "Neck1": "Chest",
    "Neck2": "Neck1", "Head": "Neck2", "Jaw": "Head", "LeftEye": "Head", "RightEye": "Head",
}
for _s in ("Left", "Right"):
    _PARENT_NAMES.update({
        f"{_s}Shoulder": "Chest", f"{_s}Arm": f"{_s}Shoulder", f"{_s}ForeArm": f"{_s}Arm",
        f"{_s}Hand": f"{_s}ForeArm", f"{_s}HandThumbEnd": f"{_s}Hand", f"{_s}HandMiddleEnd": f"{_s}Hand",
        f"{_s}Leg": "Hips", f"{_s}Shin": f"{_s}Leg", f"{_s}Foot": f"{_s}Shin", f"{_s}ToeBase": f"{_s}Foot",
    })
PARENTS = [-1 if _PARENT_NAMES[n] is None else NAMES.index(_PARENT_NAMES[n]) for n in NAMES]
IDX = {n: i for i, n in enumerate(NAMES)}
N_JOINTS = len(NAMES)

# the bones used by the plausibility gate, as (parent, child) pairs of joint indices
BONES = [(p, i) for i, p in enumerate(PARENTS) if p >= 0]

FEET = [IDX["LeftFoot"], IDX["LeftToeBase"], IDX["RightFoot"], IDX["RightToeBase"]]
HANDS = [IDX["LeftHand"], IDX["RightHand"]]
