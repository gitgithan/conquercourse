"""CMU Graphics Lab mocap (ASF skeleton + AMC motion) -> 30-joint clip. docs/pipelines.md, pipeline 2.

Credit that must travel with every clip: "The data used in this project was obtained from mocap.cs.cmu.edu"."""
import numpy as np

from .clip import Clip
from .motion import unit
from .skeleton import IDX, N_JOINTS

CREDIT = "The data used in this project was obtained from mocap.cs.cmu.edu."
METRES_PER_ASF_UNIT = (1 / 0.45) * 0.0254


def _rot(rx, ry, rz):
    """Rz . Ry . Rx for angles in degrees."""
    cx, sx, cy, sy, cz, sz = (f(np.radians(a)) for a in (rx, ry, rz) for f in (np.cos, np.sin))
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def parse_asf(text):
    """-> (bones: {name: dict(direction, length, axis, dof)}, children: {name: [names]})"""
    bones, children = {}, {}
    section, cur = None, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith(":"):
            section = line[1:].split()[0]
            continue
        tok = line.split()
        if section == "bonedata":
            if tok[0] == "begin":
                cur = {"dof": []}
            elif tok[0] == "end":
                bones[cur["name"]] = cur
                cur = None
            elif tok[0] == "name":
                cur["name"] = tok[1]
            elif tok[0] == "direction":
                cur["direction"] = np.array([float(x) for x in tok[1:4]])
            elif tok[0] == "length":
                cur["length"] = float(tok[1])
            elif tok[0] == "axis":
                cur["axis"] = [float(x) for x in tok[1:4]]
            elif tok[0] == "dof":
                cur["dof"] = tok[1:]
        elif section == "hierarchy":
            if tok[0] not in ("begin", "end"):
                children[tok[0]] = tok[1:]
    return bones, children


def parse_amc(text):
    """-> list of frames, each {bone: [values]}"""
    frames, cur = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(":"):
            continue
        tok = line.split()
        if tok[0].isdigit():
            cur = {}
            frames.append(cur)
        elif cur is not None:
            cur[tok[0]] = [float(x) for x in tok[1:]]
    return frames


def forward_kinematics(bones, children, frames):
    """World start and end of every bone per frame: {bone: (starts (T,3), ends (T,3), rotations (T,3,3))}.

    world rotation = parent rotation . C . R(dof) . C^-1; a bone's end sits `length` along its `direction`
    (turned by its world rotation) from its start; a child starts where its parent ends."""
    T = len(frames)
    out = {}

    def axis_c(name):
        if name == "root":
            return np.eye(3)
        return _rot(*bones[name]["axis"])

    def visit(name, parent_rot, start):
        rot = np.empty((T, 3, 3))
        st, en = np.empty((T, 3)), np.empty((T, 3))
        for t in range(T):
            vals = frames[t].get(name, [])
            if name == "root":
                p = np.array(vals[0:3]) * METRES_PER_ASF_UNIT
                ang = dict(zip(("rx", "ry", "rz"), vals[3:6]))
                st[t] = p
                m = _rot(ang["rx"], ang["ry"], ang["rz"])
                rot[t] = m
                en[t] = p
            else:
                b = bones[name]
                ang = {"rx": 0.0, "ry": 0.0, "rz": 0.0}
                for d, v in zip(b["dof"], vals):
                    ang[d] = v
                c = axis_c(name)
                m = c @ _rot(ang["rx"], ang["ry"], ang["rz"]) @ c.T
                rot[t] = parent_rot[t] @ m
                st[t] = start[t]
                en[t] = start[t] + rot[t] @ (b["direction"] * b["length"] * METRES_PER_ASF_UNIT)
        out[name] = (st, en, rot)
        for ch in children.get(name, []):
            visit(ch, rot, st if name == "root" else en)

    visit("root", np.broadcast_to(np.eye(3), (T, 3, 3)), None)
    return out


def _ensure_complete(bones):
    for need in ("lthumb", "lfingers", "rthumb", "rfingers"):
        assert need in bones, f"ASF has no bone {need}"


def _rigid_tip(fk, bones, carrier, chain):
    """A point at the end of the ASF rest-pose bones in `chain`, carried by `carrier`'s world rotation."""
    rest = sum(bones[b]["direction"] * bones[b]["length"] * METRES_PER_ASF_UNIT for b in chain)
    return fk[carrier][0] + np.einsum("tij,j->ti", fk[carrier][2], rest)


def to_joints(fk, bones):
    """Map CMU bone starts to the 30 SOMA joints; shoulders and head details sit between CMU points."""
    T = fk["root"][0].shape[0]
    J = np.zeros((T, N_JOINTS, 3))

    def start(b):
        return fk[b][0]

    def end(b):
        return fk[b][1]

    J[:, IDX["Hips"]] = start("root")
    J[:, IDX["Spine1"]] = start("upperback")
    J[:, IDX["Spine2"]] = start("thorax")
    J[:, IDX["Chest"]] = start("lowerneck")
    J[:, IDX["Neck1"]] = start("upperneck")
    J[:, IDX["Neck2"]] = 0.5 * (start("upperneck") + start("head"))
    J[:, IDX["Head"]] = start("head")
    # jaw and eyes sit at fixed offsets in the head bone's own frame (rest frame: +z forward, +x left, +y up)
    hr = fk["head"][2]
    head_len = np.linalg.norm(end("head") - start("head"), axis=-1)[:, None]
    for name, off in (("Jaw", (0.0, 0.35, 0.06)), ("LeftEye", (0.03, 0.65, 0.08)), ("RightEye", (-0.03, 0.65, 0.08))):
        v = np.array(off)
        local = np.array([v[0], v[1] * head_len.mean(), v[2]])
        J[:, IDX[name]] = start("head") + np.einsum("tij,j->ti", hr, local)
    for s, c in (("Left", "l"), ("Right", "r")):
        J[:, IDX[f"{s}Shoulder"]] = 0.5 * (start(f"{c}clavicle") + end(f"{c}clavicle"))
        J[:, IDX[f"{s}Arm"]] = start(f"{c}humerus")
        J[:, IDX[f"{s}ForeArm"]] = start(f"{c}radius")
        J[:, IDX[f"{s}Hand"]] = start(f"{c}wrist")
        # mitten hand: both tips ride on the wrist bone's turn, so the finger curl never changes a bone's length
        J[:, IDX[f"{s}HandThumbEnd"]] = _rigid_tip(fk, bones, f"{c}wrist", [f"{c}wrist", f"{c}thumb"])
        J[:, IDX[f"{s}HandMiddleEnd"]] = _rigid_tip(fk, bones, f"{c}wrist", [f"{c}wrist", f"{c}hand", f"{c}fingers"])
        J[:, IDX[f"{s}Leg"]] = start(f"{c}femur")
        J[:, IDX[f"{s}Shin"]] = start(f"{c}tibia")
        J[:, IDX[f"{s}Foot"]] = start(f"{c}foot")
        J[:, IDX[f"{s}ToeBase"]] = start(f"{c}toes")
    return J


def downsample_frames(frames, src_fps, dst_fps=30):
    """Every k-th frame; the rate must divide exactly (nothing is retimed)."""
    assert src_fps % dst_fps == 0, f"{src_fps} fps does not divide to {dst_fps}"
    return frames[:: int(src_fps // dst_fps)]


def orient(frames):
    """Run along +z, left on +x, y up, hips start at x = z = 0, lowest joint at y = 0.

    Heading comes from the hips' travel (or, if barely moving, from which way the body faces)."""
    f = frames.copy()
    hips = f[:, IDX["Hips"]]
    travel = hips[-1] - hips[0]
    travel[1] = 0
    if np.linalg.norm(travel) > 1.0:
        fwd = unit(travel)
    else:
        left = f[:, IDX["LeftLeg"]] - f[:, IDX["RightLeg"]]
        left[:, 1] = 0
        left = unit(left.mean(axis=0))
        fwd = np.cross(left, [0, 1, 0])
    ang = np.arctan2(fwd[0], fwd[2])  # rotate about y so fwd -> +z
    c, s = np.cos(ang), np.sin(ang)
    R = np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])
    f = f @ R.T
    f[:, :, [0, 2]] -= f[0, IDX["Hips"], [0, 2]]
    f[:, :, 1] -= f[:, :, 1].min()
    return f


def import_trial(asf_text, amc_text, src_fps=120):
    bones, children = parse_asf(asf_text)
    _ensure_complete(bones)
    amc = downsample_frames(parse_amc(amc_text), src_fps)  # frames are independent: thin them before the slow part
    joints = to_joints(forward_kinematics(bones, children, amc), bones)
    assert joints.shape[1] == N_JOINTS
    return Clip(orient(joints), 30.0)
