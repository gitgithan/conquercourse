"""The size caps for a stored character and the check that enforces them (CC-108). The same numbers live in src/characters/limits.ts; a test keeps them equal."""
import json
import struct

MAX_FACES = 3200          # the build asks for 3,000
MAX_VERTS = 6000
MAX_TEXTURE_PX = 256
MAX_GLB_BYTES = 240_000   # about 210 KB is what a 3,000-face, 256 px character weighs; 240 KB rejects anything clearly bigger
MAX_THUMB_BYTES = 8_000
BONES = 34


def read_glb(b: bytes):
    """(json, bin) of a binary glTF, or raises ValueError."""
    if len(b) < 20 or b[:4] != b"glTF":
        raise ValueError("not a glb")
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack("<I", b[off:off + 4])[0] if off + 4 <= len(b) else 0
    return j, b[off + 8: off + 8 + bl]


def png_or_jpeg_size(data: bytes):
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            m = data[i + 1]
            if m in (0xC0, 0xC1, 0xC2):
                return struct.unpack(">H", data[i + 7:i + 9])[0], struct.unpack(">H", data[i + 5:i + 7])[0]
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">I", data[16:20])[0], struct.unpack(">I", data[20:24])[0]
    return None


def glb_problems(b: bytes, bone_names=None):
    """Every reason a character glb is refused (empty list: fine)."""
    out = []
    if len(b) > MAX_GLB_BYTES:
        out.append(f"file is {len(b)} bytes, the limit is {MAX_GLB_BYTES}")
    try:
        j, bin_ = read_glb(b)
    except Exception:
        return out + ["not a readable glb"]
    if j.get("animations"):
        out.append("has animations")
    skins = j.get("skins") or []
    if len(skins) != 1:
        out.append("needs exactly one skin")
    else:
        joints = skins[0].get("joints", [])
        if len(joints) != BONES:
            out.append(f"has {len(joints)} bones, needs {BONES}")
        names = [j["nodes"][n].get("name") for n in joints]
        if bone_names is not None and names != list(bone_names):
            out.append("bone names differ from the Rookie's")
    meshes = j.get("meshes") or []
    if len(meshes) != 1 or len(meshes[0].get("primitives", [])) != 1:
        out.append("needs exactly one mesh with one primitive")
    else:
        p = meshes[0]["primitives"][0]
        faces = j["accessors"][p["indices"]]["count"] // 3
        verts = j["accessors"][p["attributes"]["POSITION"]]["count"]
        if faces > MAX_FACES:
            out.append(f"{faces} faces, the limit is {MAX_FACES}")
        if verts > MAX_VERTS:
            out.append(f"{verts} vertices, the limit is {MAX_VERTS}")
    imgs = j.get("images") or []
    if len(imgs) != 1:
        out.append("needs exactly one texture")
    else:
        bv = j["bufferViews"][imgs[0]["bufferView"]]
        size = png_or_jpeg_size(bin_[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]])
        if size is None:
            out.append("texture is not a jpeg or png")
        elif max(size) > MAX_TEXTURE_PX:
            out.append(f"texture is {size[0]} x {size[1]}, the limit is {MAX_TEXTURE_PX}")
    return out
