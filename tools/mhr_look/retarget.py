"""Pose an MHR body from its A-pose to the Rookie's T-pose, fit it to the Rookie's joints and skin it to the Rookie's 34 bones.

CPU only.  Usage:
  python retarget.py MHR_MODEL_PT ROOKIE_GLB OUT_DIR [--shape shape.json --name custom] [--height-m 1.80]
Without --shape it writes the six variants of export_variants.py.  --shape is a JSON list of the 45 MHR shape numbers.

Steps (all on the MHR mesh with the MHR's own skin weights):
  1. T-pose: each arm joint (upper arm, elbow, wrist) is turned so its bone points the way the Rookie's does.
  2. Fit: arms are stretched along x and the body is stretched along y so the MHR joints land on the Rookie's joints.
  3. Weights: every MHR joint maps to one Rookie bone; each vertex keeps its best 4 bones.
  4. Height: the whole rig is scaled (node scale on the root), never the 45 shape numbers.
"""
import argparse
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).parent))
import export_variants as ev  # noqa: E402

warnings.filterwarnings("ignore")

# MHR joint index -> Rookie bone, by chain (see the joint list in the README)
ARM = {"Left": (74, 75, 76, 77), "Right": (38, 39, 40, 41)}  # clavicle, upper arm, elbow, wrist


def bone_map():
    m = {0: "Hips", 1: "Hips", 34: "Spine1", 35: "Spine2", 36: "Chest", 37: "Chest", 110: "Neck1", 111: "Neck1", 112: "Neck1"}
    for j in range(113, 127):
        m[j] = "Head"
    for side, base in (("Left", 2), ("Right", 18)):
        m[base] = f"{side}Leg"
        m[base + 1] = f"{side}Shin"
        m[base + 2] = f"{side}Foot"
        m[base + 3] = f"{side}Foot"
        for j in (base + 4, base + 5, base + 6):
            m[j] = f"{side}ToeBase"
        for j in range(base + 7, base + 11):
            m[j] = f"{side}Shin"
        for j in range(base + 11, base + 16):
            m[j] = f"{side}Leg"
    for side, (cl, ua, el, wr) in ARM.items():
        m[cl] = f"{side}Shoulder"
        m[ua] = f"{side}Arm"
        m[el] = f"{side}ForeArm"
        for j in range(wr, wr + 24):
            m[j] = f"{side}Hand"
        for j in range(wr + 24, wr + 28):
            m[j] = f"{side}ForeArm"
        for j in range(wr + 28, wr + 33):
            m[j] = f"{side}Arm"
    return m


def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(a @ b)
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def about(R, p):
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = p - R @ p
    return M


def rookie_joints(rj, rb):
    ibm = ev.acc(rj, rb, rj["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    names = [rj["nodes"][i]["name"] for i in rj["skins"][0]["joints"]]
    return names, {n: np.linalg.inv(ibm[k])[:3, 3] for k, n in enumerate(names)}


def load_model(pt):
    m = torch.jit.load(pt, map_location="cpu")
    c = m.character_torch
    with torch.no_grad():
        _, st = m(torch.zeros(1, 45), torch.zeros(1, 204), torch.zeros(1, 72))
    lbs = c.linear_blend_skinning
    W = np.zeros((18439, 127))
    W[lbs.vert_indices_flattened.numpy(), lbs.skin_indices_flattened.numpy()] = lbs.skin_weights_flattened.numpy()
    return st[0, :, :3].numpy().astype(np.float64), W


def t_pose(verts, J, W, rpos):
    """Turn the arms to the Rookie's bone directions; returns new verts (cm) and the posed joint positions."""
    D = {j: np.eye(4) for j in range(127)}
    P = J.copy()
    for side, (cl, ua, el, wr) in ARM.items():
        tip = np.mean([J[wr + 14], J[wr + 10], J[wr + 18]], axis=0)  # the middle fingers' last joints
        chain = [(ua, el, f"{side}Arm", f"{side}ForeArm"), (el, wr, f"{side}ForeArm", f"{side}Hand")]
        parent = np.eye(4)
        Dj = {}
        for a, b, ra, rb_ in chain:
            pa = (parent @ np.append(J[a], 1))[:3]
            pb = (parent @ np.append(J[b], 1))[:3]
            R = rot_between(pb - pa, rpos[rb_] - rpos[ra])
            parent = about(R, pa) @ parent
            Dj[a] = parent
        pw = (parent @ np.append(J[wr], 1))[:3]
        pt = (parent @ np.append(tip, 1))[:3]
        parent = about(rot_between(pt - pw, rpos[f"{side}HandMiddleEnd"] - rpos[f"{side}Hand"]), pw) @ parent
        Dj[wr] = parent
        D[ua], D[el], D[wr] = Dj[ua], Dj[el], Dj[wr]
        for j in range(wr + 1, wr + 24):
            D[j] = Dj[wr]
        for j in range(wr + 24, wr + 28):
            D[j] = Dj[el]
        for j in range(wr + 28, wr + 33):
            D[j] = Dj[ua]
        for j in (ua, el, wr, *range(wr + 1, wr + 33)):
            P[j] = (D[j] @ np.append(J[j], 1))[:3]
        ARM_TIP[side] = (Dj[wr] @ np.append(tip, 1))[:3]
    out = np.zeros_like(verts)
    for j in range(127):
        col = W[:, j]
        nz = col > 0
        if not nz.any():
            continue
        h = np.c_[verts[nz], np.ones(nz.sum())]
        out[nz] += col[nz, None] * (h @ D[j].T)[:, :3]
    return out, P


ARM_TIP = {}


def pw_map(x, src, dst):
    """Piecewise-linear map through the knots, slope 1 outside them."""
    x = np.asarray(x, float)
    y = np.interp(x, src, dst)
    y = np.where(x < src[0], dst[0] + (x - src[0]), y)
    return np.where(x > src[-1], dst[-1] + (x - src[-1]), y)


def fit_to_rookie(v, P, W, rpos, scale):
    """v, P in metres. Arms stretch along x (blended by arm weight), then the whole body along y."""
    v = v.copy()
    for side, sgn in (("Left", 1.0), ("Right", -1.0)):
        cl, ua, el, wr = ARM[side]
        arm_w = W[:, [ua, el, *range(wr, wr + 33)]].sum(1)
        arm_w = np.clip(arm_w, 0, 1)
        src = [0.0, P[ua, 0] * sgn, P[el, 0] * sgn, P[wr, 0] * sgn, ARM_TIP[side][0] * sgn]
        dst = [0.0, rpos[f"{side}Arm"][0] * sgn, rpos[f"{side}ForeArm"][0] * sgn, rpos[f"{side}Hand"][0] * sgn,
               rpos[f"{side}HandMiddleEnd"][0] * sgn]
        mask = (v[:, 0] * sgn > 0)
        nx = pw_map(v[:, 0] * sgn, src, dst) * sgn
        v[:, 0] = np.where(mask, v[:, 0] + arm_w * (nx - v[:, 0]), v[:, 0])
    ysrc = [0.0, P[4, 1], P[3, 1], P[2, 1], P[75, 1], v[:, 1].max()]
    ydst = [0.0, rpos["LeftFoot"][1], rpos["LeftShin"][1], rpos["LeftLeg"][1], rpos["LeftArm"][1], 1.75]
    v[:, 1] = pw_map(v[:, 1], ysrc, ydst)
    xl = np.abs(v[:, 0])
    leg = np.clip(W[:, list(range(2, 8)) + list(range(9, 18))].sum(1) + W[:, list(range(18, 24)) + list(range(25, 34))].sum(1), 0, 1)
    side = np.sign(v[:, 0])
    v[:, 0] += leg * side * (rpos["LeftLeg"][0] - P[2, 0]) * np.minimum(1, xl / 0.05)
    return v


def skin_from_mhr(W, rnames):
    bm = bone_map()
    ridx = {n: i for i, n in enumerate(rnames)}
    Wr = np.zeros((len(W), len(rnames)))
    for j, n in bm.items():
        Wr[:, ridx[n]] += W[:, j]
    top = np.argsort(-Wr, axis=1)[:, :4]
    w = np.take_along_axis(Wr, top, 1)
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    return top.astype(np.uint16), w.astype(np.float32)


def build(pt, rookie, out, shapes, heights):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    base, vec, faces = ev.load(pt)
    J, W = load_model(pt)
    rj, rb = ev.read_glb(rookie)
    rnames, rpos = rookie_joints(rj, rb)
    Jr, Wr = skin_from_mhr(W, rnames)
    info = {}
    for name, c in shapes.items():
        raw = base + np.tensordot(c, vec, axes=1)
        v_cm, P = t_pose(raw, J, W, rpos)
        scale = ev.HEIGHT_M / ((raw[:, 1].max() - raw[:, 1].min()) / 100.0)
        # the same scale and offsets as ev.fit, applied to the joints too
        v = v_cm / 100.0 * scale
        P = P / 100.0 * scale
        foot = v[:, 1].min()
        v[:, 1] -= foot; P[:, 1] -= foot
        cx = (v[:, 0].max() + v[:, 0].min()) / 2
        for side in ARM_TIP:
            ARM_TIP[side] = ARM_TIP[side] / 100.0 * scale
            ARM_TIP[side][1] -= foot
        v[:, 0] -= cx; P[:, 0] -= cx
        for side in ARM_TIP:
            ARM_TIP[side][0] -= cx
        v = fit_to_rookie(v, P, W, rpos, scale)
        v[:, 1] = np.clip(v[:, 1], 0, None)
        h = heights.get(name)
        extras = {"mhrLook": {"name": name, "referenceHeightM": ev.HEIGHT_M, "heightM": h or ev.HEIGHT_M}}
        path = out / f"mhr-{name}-t.glb"
        j2 = json.loads(json.dumps(rj))
        ev.skinned_glb(path, j2, rb, v, faces, Jr, Wr)
        # height: scale the whole rig (scene root node), not the shape numbers
        d = path.read_bytes()
        n = int.from_bytes(d[12:16], "little")
        g = json.loads(d[20:20 + n]); bn = d[20 + n + 8:]
        s = (h or ev.HEIGHT_M) / ev.HEIGHT_M
        root = g["scenes"][g["scene"]]["nodes"]
        top = g["nodes"].__len__()
        g["nodes"].append({"name": "mhr-height", "children": root, "scale": [s, s, s]})
        g["scenes"][g["scene"]]["nodes"] = [top]
        g["scenes"][g["scene"]]["extras"] = extras
        ev.write_glb(path, g, bn)
        info[name] = {"glb": path.name, "bytes": path.stat().st_size, "height_m": h or ev.HEIGHT_M,
                      "arm_span_m": round(float(np.ptp(v[:, 0])), 3), "top_m": round(float(v[:, 1].max()), 3)}
        print(name, info[name])
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mhr"); ap.add_argument("rookie"); ap.add_argument("out")
    ap.add_argument("--shape"); ap.add_argument("--name", default="custom"); ap.add_argument("--height-m", type=float)
    a = ap.parse_args()
    if a.shape:
        s = json.loads(Path(a.shape).read_text())
        s = s.get("shape_params", s) if isinstance(s, dict) else s
        shapes = {a.name: np.asarray(s, float)}
        heights = {a.name: a.height_m} if a.height_m else {}
    else:
        base, vec, _ = ev.load(a.mhr)
        shapes, heights = ev.variants(base, vec), {}
    info = build(a.mhr, a.rookie, a.out, shapes, heights)
    (Path(a.out) / "retarget.json").write_text(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
