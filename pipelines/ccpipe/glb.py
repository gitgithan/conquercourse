"""A small binary glTF (GLB) writer for one coloured mesh: positions, smooth normals, vertex colours, indices.

No textures and no extensions, so a shipped object stays far under 1.5 MB (6,000 faces is about 150 KB)."""
import io
import json
import struct

import numpy as np
from PIL import Image

FLOAT, UBYTE, USHORT, UINT = 5126, 5121, 5123, 5125
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


def vertex_normals(v, f):
    """Smooth normals: each face's area-weighted normal added to its three vertices."""
    v = np.asarray(v, float)
    f = np.asarray(f, np.int64)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    n = np.zeros_like(v)
    for i in range(3):
        np.add.at(n, f[:, i], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.where(ln > 1e-12, ln, 1)


def srgb_to_linear(c01):
    c = np.asarray(c01, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def write_glb(path, v, f, colours_u8=None, name="object", uv=None, texture=None, jpeg_quality=90):
    """Write the mesh to `path`.

    `colours_u8` are sRGB (what a photo holds) and are stored as glTF's linear vertex colours.
    `uv` (glTF convention, origin top-left) and `texture` (uint8 h x w x 3, sRGB) give a base-colour texture, stored as an embedded JPEG."""
    v = np.asarray(v, np.float32)
    f = np.asarray(f, np.int64)
    n = vertex_normals(v, f).astype(np.float32)
    idx_type, idx_dtype = (USHORT, np.uint16) if len(v) < 65536 else (UINT, np.uint32)
    blobs, views, accessors = [], [], []

    def add(data, comp, kind, target, extra=None):
        raw = data.tobytes()
        pad = (-sum(len(b) for b in blobs)) % 4
        if pad:
            blobs.append(b"\0" * pad)
        views.append({"buffer": 0, "byteOffset": sum(len(b) for b in blobs), "byteLength": len(raw), "target": target})
        blobs.append(raw)
        acc = {"bufferView": len(views) - 1, "componentType": comp, "count": int(len(data)), "type": kind}
        acc.update(extra or {})
        accessors.append(acc)
        return len(accessors) - 1

    attrs = {"POSITION": add(v, FLOAT, "VEC3", ARRAY_BUFFER, {"min": v.min(0).tolist(), "max": v.max(0).tolist()}),
             "NORMAL": add(n, FLOAT, "VEC3", ARRAY_BUFFER)}
    if colours_u8 is not None:
        lin = np.round(srgb_to_linear(np.asarray(colours_u8, float) / 255) * 255).astype(np.uint8)
        attrs["COLOR_0"] = add(lin, UBYTE, "VEC3", ARRAY_BUFFER, {"normalized": True})
    if uv is not None:
        attrs["TEXCOORD_0"] = add(np.asarray(uv, np.float32), FLOAT, "VEC2", ARRAY_BUFFER)
    indices = add(f.astype(idx_dtype).reshape(-1), idx_type, "SCALAR", ELEMENT_ARRAY_BUFFER)
    material = {"name": "skin", "doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}}
    extra = {}
    if texture is not None:
        buf = io.BytesIO()
        Image.fromarray(np.asarray(texture, np.uint8)).save(buf, "JPEG", quality=jpeg_quality)
        raw = buf.getvalue()
        pad = (-sum(len(b) for b in blobs)) % 4
        if pad:
            blobs.append(b"\0" * pad)
        views.append({"buffer": 0, "byteOffset": sum(len(b) for b in blobs), "byteLength": len(raw)})
        blobs.append(raw)
        extra = {"images": [{"bufferView": len(views) - 1, "mimeType": "image/jpeg"}], "textures": [{"source": 0, "sampler": 0}],
                 "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}]}
        material["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
    body = b"".join(blobs)
    body += b"\0" * ((-len(body)) % 4)
    doc = {
        "asset": {"version": "2.0", "generator": "ConquerCourse photo_to_object"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}],
        "meshes": [{"name": name, "primitives": [{"attributes": attrs, "indices": indices, "material": 0, "mode": 4}]}],
        "materials": [material], "buffers": [{"byteLength": len(body)}], "bufferViews": views, "accessors": accessors, **extra,
    }
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(body)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, total))
        fh.write(struct.pack("<I4s", len(js), b"JSON") + js)
        fh.write(struct.pack("<I4s", len(body), b"BIN\0") + body)
    return total


def read_glb(path):
    """Read back what write_glb wrote: (vertices, faces, colours uint8 linear or None, json document)."""
    data = open(path, "rb").read()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError("not a GLB 2.0 file of the stated length")
    jl, _ = struct.unpack_from("<I4s", data, 12)
    doc = json.loads(data[20:20 + jl])
    bl, _ = struct.unpack_from("<I4s", data, 20 + jl)
    binary = data[28 + jl:28 + jl + bl]

    def get(i):
        a = doc["accessors"][i]
        bv = doc["bufferViews"][a["bufferView"]]
        dt = {FLOAT: np.float32, UBYTE: np.uint8, USHORT: np.uint16, UINT: np.uint32}[a["componentType"]]
        w = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
        return np.frombuffer(binary, dt, a["count"] * w, bv["byteOffset"]).reshape(a["count"], w)

    prim = doc["meshes"][0]["primitives"][0]
    v = get(prim["attributes"]["POSITION"])
    f = get(prim["indices"]).reshape(-1, 3).astype(np.int64)
    c = get(prim["attributes"]["COLOR_0"]) if "COLOR_0" in prim["attributes"] else None
    return v, f, c, doc
