"""(CC-108) Rig a baked, textured character mesh onto the game's 34-bone SOMA skeleton (the one rookie-a.glb carries).

Nothing here is Blender: the skeleton and its rest pose are read from rookie-a.glb, the new mesh is fitted into the same box,
each vertex takes weights from its nearest bones (inverse fourth power of the distance to the bone's segments, the same fallback the Rookie rig
used for stray vertices), and a new GLB is written that keeps rookie-a's nodes, skin and material so loadRookie(..., url) accepts it."""
import io, json, struct
import numpy as np
from PIL import Image

import os
TEMPLATE = os.environ.get("CC_ROOKIE_GLB") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "assets", "characters", "rookie-a.glb")


def read_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack("<I", b[off:off + 4])[0]
    return j, b[off + 8: off + 8 + bl]


def acc(j, bin_, i):
    a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    dt = {5126: "<f4", 5121: "u1", 5123: "<u2", 5125: "<u4"}[a["componentType"]]
    o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    return np.frombuffer(bin_, dt, a["count"] * n, o).reshape(a["count"], n)


class Template:
    def __init__(self, path=TEMPLATE):
        self.j, self.bin = read_glb(path)
        sk = self.j["skins"][0]
        self.joint_nodes = sk["joints"]
        self.names = [self.j["nodes"][n]["name"] for n in self.joint_nodes]
        ibm = acc(self.j, self.bin, sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)  # glTF is column-major
        self.pos = np.array([np.linalg.inv(m)[:3, 3] for m in ibm])
        node_to_joint = {n: i for i, n in enumerate(self.joint_nodes)}
        self.parent = [-1] * len(self.names)
        for n in self.j["nodes"]:
            for c in n.get("children", []):
                if c in node_to_joint and self.j["nodes"].index(n) in node_to_joint:
                    self.parent[node_to_joint[c]] = node_to_joint[self.j["nodes"].index(n)]
        self.ibm_bytes = np.ascontiguousarray(acc(self.j, self.bin, sk["inverseBindMatrices"]), "<f4").tobytes()
        p = acc(self.j, self.bin, self.j["meshes"][0]["primitives"][0]["attributes"]["POSITION"])
        self.v = p.astype(np.float64)
        self.w = acc(self.j, self.bin, self.j["meshes"][0]["primitives"][0]["attributes"]["WEIGHTS_0"]).astype(np.float64)
        self.jt = acc(self.j, self.bin, self.j["meshes"][0]["primitives"][0]["attributes"]["JOINTS_0"]).astype(np.int64)
        self.bbox = (p.min(0), p.max(0))
        # which way the feet point: the toe bone is in front of the foot bone
        i = {n: k for k, n in enumerate(self.names)}
        self.front_sign = float(np.sign(self.pos[i["LeftToeBase"], 2] - self.pos[i["LeftFoot"], 2]) or 1)


def segments(t):
    """(bone index, start, end): each bone owns the segments to its children; a bone with none gets a short stub."""
    out = []
    for j, p in enumerate(t.parent):
        if p >= 0:
            out.append((p, t.pos[p], t.pos[j]))
    owned = {s[0] for s in out}
    for j in range(len(t.names)):
        if j not in owned:
            out.append((j, t.pos[j], t.pos[j] + np.array([0, -0.02, 0])))
    return out


def seg_dist(P, a, b):
    ab = b - a; L = float(ab @ ab)
    s = np.clip(((P - a) @ ab) / L, 0, 1) if L > 1e-12 else np.zeros(len(P))
    return np.linalg.norm(P - (a + s[:, None] * ab), axis=1)


def nearest_bone_weights(t, V, k=4, power=4):
    segs = segments(t)
    nb = len(t.names)
    D = np.full((len(V), nb), 1e9)
    for bone, a, b in segs:
        D[:, bone] = np.minimum(D[:, bone], seg_dist(V, a, b))
    idx = np.argsort(D, 1)[:, :k]
    d = np.take_along_axis(D, idx, 1)
    w = 1.0 / (d + 0.01) ** power
    w /= w.sum(1, keepdims=True)
    return idx.astype(np.uint8), w.astype(np.float32)


def fit_to_template(t, V, front_flip=False):
    """Scale the mesh (y up, feet on y=0, centred) into the template's box: same height, same arm span, thickness by the mean scale."""
    V = V.copy()
    lo, hi = V.min(0), V.max(0)
    tl, th = t.bbox
    sy = (th[1] - tl[1]) / (hi[1] - lo[1])
    sx = (th[0] - tl[0]) / (hi[0] - lo[0])
    sx = min(max(sx, 0.6 * sy), 1.6 * sy)  # a very wide or very thin figure must not stretch without limit
    sz = (sx + sy) / 2
    V[:, 0] = (V[:, 0] - (lo[0] + hi[0]) / 2) * sx
    V[:, 1] = (V[:, 1] - lo[1]) * sy
    V[:, 2] = (V[:, 2] - (lo[2] + hi[2]) / 2) * sz
    return V, {"sx": float(sx), "sy": float(sy), "sz": float(sz)}


def vertex_normals(v, f):
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    n = np.zeros_like(v)
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    return (n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)).astype(np.float32)


def pad4(b):
    return b + b"\0" * (-len(b) % 4)


def write_skinned_glb(path, t, V, F, UV, tex_u8, joints, weights, jpeg_quality=80, tex_size=512):
    V = np.asarray(V, "<f4"); F = np.asarray(F)
    N = vertex_normals(V.astype(np.float64), F)
    idx_dt = "<u2" if len(V) < 65536 else "<u4"
    im = Image.fromarray(tex_u8).convert("RGB")
    if max(im.size) > tex_size:
        im = im.resize((tex_size, tex_size), Image.LANCZOS)
    jb = io.BytesIO(); im.save(jb, "JPEG", quality=jpeg_quality, optimize=True)
    j4 = np.zeros((len(V), 4), np.uint8); j4[:, : joints.shape[1]] = joints
    w4 = np.zeros((len(V), 4), "<f4"); w4[:, : weights.shape[1]] = weights
    w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-9)
    parts = [  # (bytes, target, accessor spec or None)
        (V.tobytes(), 34962, dict(componentType=5126, type="VEC3", count=len(V), min=V.min(0).tolist(), max=V.max(0).tolist())),
        (N.astype("<f4").tobytes(), 34962, dict(componentType=5126, type="VEC3", count=len(V))),
        (np.asarray(UV, "<f4").tobytes(), 34962, dict(componentType=5126, type="VEC2", count=len(V))),
        (j4.tobytes(), 34962, dict(componentType=5121, type="VEC4", count=len(V))),
        (w4.tobytes(), 34962, dict(componentType=5126, type="VEC4", count=len(V))),
        (F.astype(idx_dt).reshape(-1).tobytes(), 34963, dict(componentType=5123 if idx_dt == "<u2" else 5125, type="SCALAR", count=int(F.size))),
        (t.ibm_bytes, None, dict(componentType=5126, type="MAT4", count=len(t.names))),
        (jb.getvalue(), None, None),
    ]
    j = json.loads(json.dumps(t.j)); j["accessors"] = []; j["bufferViews"] = []
    blob = b""
    for data, target, spec in parts:
        bv = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)}
        if target: bv["target"] = target
        j["bufferViews"].append(bv); blob += pad4(data)
        if spec: j["accessors"].append({"bufferView": len(j["bufferViews"]) - 1, **spec})
    j["meshes"][0]["primitives"][0]["indices"] = 5
    j["skins"][0]["inverseBindMatrices"] = 6
    j["images"][0].update(bufferView=7, mimeType="image/jpeg")
    j["buffers"] = [{"byteLength": len(blob)}]
    js = pad4(json.dumps(j, separators=(",", ":")).encode()).replace(b"\0", b" ") if False else json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(blob), b"BIN\0") + blob
    if path is not None:
        open(path, "wb").write(out)
    return (len(out), len(jb.getvalue())) if path is not None else (out, len(jb.getvalue()))


# ---- checks used by the tests and the package step (CC-108) ----
def rot(axis, deg):
    a = np.deg2rad(deg); c, s = np.cos(a), np.sin(a)
    if axis == "x":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "y":
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


# a handful of poses that stand for run, leap and land: (bone name, axis, degrees)
POSES = {
    "arms_up": [("LeftArm", "z", 70), ("RightArm", "z", -70)],
    "stride": [("LeftUpLeg", "x", 40), ("RightUpLeg", "x", -40), ("LeftForeArm", "x", -50)],
    "crouch": [("LeftUpLeg", "x", 70), ("RightUpLeg", "x", 70), ("LeftLeg", "x", -90), ("RightLeg", "x", -90), ("Spine1", "x", 25)],
}


def pose_vertices(t, V, joints, weights, pose):
    """Linear blend skinning in numpy: rotate the named bones about their own rest positions (children follow)."""
    n = len(t.names)
    idx = {nm: i for i, nm in enumerate(t.names)}
    local = [np.eye(4) for _ in range(n)]
    for nm, axis, deg in pose:
        if nm in idx:
            b = idx[nm]; M = np.eye(4); M[:3, :3] = rot(axis, deg)
            M[:3, 3] = t.pos[b] - M[:3, :3] @ t.pos[b]
            local[b] = M
    world = [None] * n
    order = sorted(range(n), key=lambda i: 0 if t.parent[i] < 0 else 1)
    done = set()
    def get(i):
        if world[i] is None:
            world[i] = local[i] if t.parent[i] < 0 else get(t.parent[i]) @ local[i]
        return world[i]
    for i in order:
        get(i)
    Vh = np.c_[V, np.ones(len(V))]
    out = np.zeros_like(V, dtype=float)
    for k in range(joints.shape[1]):
        M = np.stack([world[j] for j in joints[:, k]])
        out += weights[:, k:k + 1] * np.einsum("nij,nj->ni", M, Vh)[:, :3]
    return out


def edge_stretch(t, V, F, joints, weights, poses=POSES):
    """For each pose the posed/rest length of every triangle edge: returns {pose: (mean, p99, worst)}."""
    E = np.unique(np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1), axis=0)
    rest = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1)
    keep = rest > 1e-4
    out = {}
    for name, pose in poses.items():
        P = pose_vertices(t, V, joints, weights, pose)
        r = np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1)[keep] / rest[keep]
        out[name] = (float(r.mean()), float(np.percentile(r, 99)), float(r.max()))
    return out


def weight_problems(joints, weights, bones=34):
    """Empty when every vertex has weights that sum to 1 on bones that exist."""
    out = []
    if (joints >= bones).any():
        out.append("a joint index is not a bone")
    s = weights.sum(1)
    if not np.allclose(s, 1, atol=1e-3):
        out.append("some vertex weights do not sum to 1")
    if (s <= 0).any():
        out.append("some vertex has no weight")
    if not np.isfinite(weights).all():
        out.append("non-finite weights")
    return out
