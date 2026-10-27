"""Export the neutral MHR body and 5 shape (identity) variants as small GLBs, and skin them to the Rookie's rig.

CPU only.  Usage: python export_variants.py MHR_MODEL_PT ROOKIE_GLB OUT_DIR
The MHR model is a TorchScript file (SAM 3D Body checkpoint folder, assets/mhr_model.pt).
Shape = base_shape + sum(coeff[i] * shape_vectors[i]) over the 45 identity vectors (centimetres).
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
import torch

HEIGHT_M = 1.75  # the Rookie's height; every variant is fitted to it so it fits the Rookie's bones


def load(pt):
    m = torch.jit.load(pt, map_location="cpu")
    bs = m.character_torch.blend_shape
    faces = m.character_torch.mesh.faces.numpy().astype(np.uint32)
    return bs.base_shape.numpy().astype(np.float64), bs.shape_vectors.numpy().astype(np.float64), faces


def directions(base, vec):
    """Unit identity directions found from the model itself: which mix of the 45 vectors does what."""
    y, x = base[:, 1], base[:, 0]
    top, bot = np.argsort(y)[-200:], np.argsort(y)[:200]
    band = (y > 100) & (y < 125) & (np.abs(x) < 25)
    sh = (y > 135) & (y < 150) & (np.abs(x) < 30)
    def lin(f):
        g = np.array([f(vec[i]) for i in range(len(vec))])
        return g / np.linalg.norm(g)
    height = lin(lambda v: v[top, 1].mean() - v[bot, 1].mean())
    torso_w = lin(lambda v: v[band, 0].max() - v[band, 0].min())
    torso_d = lin(lambda v: v[band, 2].max() - v[band, 2].min())
    shoulder = lin(lambda v: v[sh, 0].max() - v[sh, 0].min())
    return {"height": height, "torso_w": torso_w, "torso_d": torso_d, "shoulder": shoulder}


def variants(base, vec):
    d = directions(base, vec)
    k = 3.0  # standard deviations; SAM 3D Body predicts shape in this range
    return {
        "neutral": np.zeros(45),
        "tall": k * d["height"],
        "short": -k * d["height"],
        "broad": 3.0 * d["shoulder"] + 1.0 * d["torso_w"],
        "slim": -k * (0.7 * d["torso_w"] + 0.7 * d["torso_d"]),
        "stocky": 1.5 * d["torso_w"] + 1.5 * d["torso_d"] - 1.0 * d["height"],
    }


def normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def pad4(b):
    return b + b"\0" * (-len(b) % 4)


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binary = pad4(binary)
    out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(binary))
    out += struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    Path(path).write_bytes(out)


def fit(verts_cm, faces):
    """Metres, feet on the floor, centred on x/z, scaled to the Rookie's height; returns the scale used."""
    v = verts_cm / 100.0
    h = v[:, 1].max() - v[:, 1].min()
    s = HEIGHT_M / h
    v = v * s
    v[:, 1] -= v[:, 1].min()
    v[:, 0] -= (v[:, 0].max() + v[:, 0].min()) / 2
    v[:, 2] -= v[:, 2].mean()
    return v, s, h


def static_glb(path, v, f, name):
    n = normals(v, f)
    pos = v.astype("<f4").tobytes(); nor = n.astype("<f4").tobytes(); idx = f.astype("<u4").tobytes()
    gltf = {"asset": {"version": "2.0", "generator": "cc-41 export_variants"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}],
            "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.78, 0.66, 0.58, 1], "metallicFactor": 0, "roughnessFactor": 0.9}}],
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
            "accessors": [
                {"bufferView": 0, "componentType": 5126, "count": len(v), "type": "VEC3", "min": v.min(0).tolist(), "max": v.max(0).tolist()},
                {"bufferView": 1, "componentType": 5126, "count": len(v), "type": "VEC3"},
                {"bufferView": 2, "componentType": 5125, "count": f.size, "type": "SCALAR"}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos), "target": 34962},
                            {"buffer": 0, "byteOffset": len(pos), "byteLength": len(nor), "target": 34962},
                            {"buffer": 0, "byteOffset": len(pos) + len(nor), "byteLength": len(idx), "target": 34963}],
            "buffers": [{"byteLength": len(pos) + len(nor) + len(idx)}]}
    write_glb(path, gltf, pos + nor + idx)


def read_glb(path):
    d = Path(path).read_bytes()
    n = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + n])
    b = d[20 + n + 8:]
    return j, b


def acc(j, b, i):
    a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]
    ct = {5126: "<f4", 5125: "<u4", 5123: "<u2", 5121: "u1"}[a["componentType"]]
    nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    return np.frombuffer(b, dtype=ct, count=a["count"] * nc, offset=off).reshape(a["count"], nc)


def transfer_weights(rv, rj, rw, v, k=4):
    """Each body vertex takes the bone weights of its k nearest Rookie vertices (inverse-distance mix, best 4 bones)."""
    from scipy.spatial import cKDTree
    dist, nn = cKDTree(rv).query(v, k=k)
    w = 1.0 / np.maximum(dist, 1e-4)
    w /= w.sum(1, keepdims=True)
    J = np.zeros((len(v), 4), dtype=np.uint16); W = np.zeros((len(v), 4), dtype=np.float32)
    for i in range(len(v)):
        acc_ = {}
        for c in range(k):
            for jj, ww in zip(rj[nn[i, c]], rw[nn[i, c]]):
                if ww > 0:
                    acc_[int(jj)] = acc_.get(int(jj), 0.0) + float(ww) * w[i, c]
        top = sorted(acc_.items(), key=lambda t: -t[1])[:4]
        s = sum(t[1] for t in top)
        for c, (jj, ww) in enumerate(top):
            J[i, c] = jj; W[i, c] = ww / s
    return J, W


def skinned_glb(path, rookie_json, rookie_bin, v, f, rj, rw_):
    j = json.loads(json.dumps(rookie_json)); rb = rookie_bin
    skin = j["skins"][0]
    ibm = acc(j, rb, skin["inverseBindMatrices"]).astype("<f4").tobytes()
    J, W = rj, rw_
    n = normals(v, f)
    parts = [v.astype("<f4").tobytes(), n.astype("<f4").tobytes(), J.astype("<u2").tobytes(), W.astype("<f4").tobytes(),
             f.astype("<u4").tobytes(), ibm]
    views, off = [], 0
    for i, p in enumerate(parts):
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(p)})
        off += len(p)
    j["bufferViews"] = views
    j["buffers"] = [{"byteLength": off}]
    j["accessors"] = [
        {"bufferView": 0, "componentType": 5126, "count": len(v), "type": "VEC3", "min": v.min(0).tolist(), "max": v.max(0).tolist()},
        {"bufferView": 1, "componentType": 5126, "count": len(v), "type": "VEC3"},
        {"bufferView": 2, "componentType": 5123, "count": len(v), "type": "VEC4"},
        {"bufferView": 3, "componentType": 5126, "count": len(v), "type": "VEC4"},
        {"bufferView": 4, "componentType": 5125, "count": f.size, "type": "SCALAR"},
        {"bufferView": 5, "componentType": 5126, "count": len(ibm) // 64, "type": "MAT4"}]
    skin["inverseBindMatrices"] = 5
    j["materials"] = [{"name": "skin", "pbrMetallicRoughness": {"baseColorFactor": [0.78, 0.66, 0.58, 1], "metallicFactor": 0, "roughnessFactor": 0.9}}]
    j["meshes"][0]["primitives"] = [{"attributes": {"POSITION": 0, "NORMAL": 1, "JOINTS_0": 2, "WEIGHTS_0": 3}, "indices": 4, "material": 0}]
    for k in ("images", "textures", "samplers"):
        j.pop(k, None)
    j.pop("animations", None)
    write_glb(path, j, b"".join(parts))


def main(pt, rookie, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    base, vec, faces = load(pt)
    rj_, rb = read_glb(rookie)
    prim = rj_["meshes"][0]["primitives"][0]["attributes"]
    rv, rjn, rwt = acc(rj_, rb, prim["POSITION"]).astype(np.float64), acc(rj_, rb, prim["JOINTS_0"]), acc(rj_, rb, prim["WEIGHTS_0"])
    info = {}
    for name, c in variants(base, vec).items():
        verts, s, h0 = fit(base + np.tensordot(c, vec, axes=1), faces)
        static_glb(out / f"mhr-{name}.glb", verts, faces, f"mhr-{name}")
        J, W = transfer_weights(rv, rjn, rwt, verts)
        skinned_glb(out / f"mhr-{name}-rookie-rig.glb", rj_, rb, verts, faces, J, W)
        info[name] = {"coefficients_nonzero": {str(i): round(float(x), 3) for i, x in enumerate(c) if abs(x) > 0.05},
                      "raw_height_cm": round(float(h0), 2), "scale_to_1.75m": round(float(s), 4),
                      "width_m_torso_band": round(float((np.ptp(verts[(verts[:, 1] > 1.0) & (verts[:, 1] < 1.25) & (abs(verts[:, 0]) < 0.25), 0]))), 3)}
        print(name, info[name]["raw_height_cm"], info[name]["width_m_torso_band"])
    (out / "variants.json").write_text(json.dumps({"faces": int(len(faces)), "vertices": int(len(base)), "variants": info}, indent=2))


if __name__ == "__main__":
    main(*sys.argv[1:4])
