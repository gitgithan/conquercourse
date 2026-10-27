"""Bake a lifted object into a game skin (CPU): upright, side-on, on the ground, sized, light, coloured.

The lift (SAM 3D Objects) gives a mesh with no colour and a Gaussian splat in the same frame, z up, at an arbitrary size.
The camera layout it also returns is never applied: it tilts the object by the camera's pitch.
Everything here is numpy (plus scipy's KD-tree and fast_simplification); no GPU."""
import numpy as np

# Typical heights in metres by label, for when nobody typed the real height; the same family as src/park/fit.ts TYPICAL.
# A bench is measured with its back (0.8); a backless bench should be typed as 0.45.
TYPICAL_HEIGHT = {
    "bench": 0.8, "low wall": 0.9, "wall": 0.9, "rail": 1.0, "handrail": 1.0, "railing": 1.0, "ledge": 0.5,
    "platform": 0.5, "concrete block": 0.6, "box": 0.6, "steps": 0.7, "stairs": 0.7,
    "wooden crate": 1.0, "bollard": 0.95, "cone": 0.7,
}
DEFAULT_HEIGHT = 0.8
MAX_FACES = 6000
SH_C0 = 0.28209479177387814  # spherical harmonic degree 0: colour = 0.5 + C0 * dc


def resolve_height(label, typed=None):
    """(height in metres, source): the typed height wins; else the typical height for the label; else a default."""
    if typed is not None:
        if not 0.1 <= typed <= 6:
            raise ValueError(f"typed height {typed} m is outside 0.1 to 6 m")
        return float(typed), "typed"
    key = (label or "").strip().lower()
    if key in TYPICAL_HEIGHT:
        return TYPICAL_HEIGHT[key], f"typical:{key}"
    return DEFAULT_HEIGHT, "default"


def z_up_to_y_up(p):
    """The lift's frame (z up) to the game's (y up, x along the course, z toward the camera): a turn of -90 degrees about x."""
    p = np.asarray(p, float)
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], 1)


def widest_side_yaw(p):
    """Yaw (radians, about y) that makes the horizontal bounding box smallest and its longer side run along x.

    Rotating about y by this angle turns the object's widest side to face a camera looking along -z."""
    xz = np.asarray(p, float)[:, [0, 2]]
    best = None
    for deg in np.arange(0, 90, 0.5):
        a = np.radians(deg)
        c, s = np.cos(a), np.sin(a)
        u = xz[:, 0] * c + xz[:, 1] * s
        v = -xz[:, 0] * s + xz[:, 1] * c
        ext_u, ext_v = np.ptp(u), np.ptp(v)
        area = ext_u * ext_v
        if best is None or area < best[0] - 1e-12:
            best = (area, a, ext_u, ext_v)
    _, a, ext_u, ext_v = best
    # u runs along angle a, v along a + 90 degrees; the longer one becomes the x axis
    return a if ext_u >= ext_v else a + np.pi / 2


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


class Pose:
    """new = scale * (R @ old) + t, applied to the mesh and to the splat alike."""

    def __init__(self, R, scale, t):
        self.R, self.scale, self.t = R, float(scale), np.asarray(t, float)

    def apply(self, p):
        return self.scale * (np.asarray(p, float) @ self.R.T) + self.t


def fit_pose(raw_vertices, height_m):
    """Upright (z up to y up), widest side to x, centred in x and z, standing on y = 0, height = height_m."""
    v = z_up_to_y_up(raw_vertices)
    yaw = widest_side_yaw(v)
    R = rot_y(yaw) @ np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]])  # raw -> y up, then the yaw
    w = np.asarray(raw_vertices, float) @ R.T
    h = np.ptp(w[:, 1])
    if h <= 0:
        raise ValueError("the mesh has no height")
    s = height_m / h
    lo, hi = w.min(0), w.max(0)
    t = -s * np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    return Pose(R, s, t), {"yaw_deg": round(float(np.degrees(yaw)), 2), "raw_height": round(float(h), 4), "scale": round(float(s), 4)}


def base_tilt_deg(v, f, facing=0.7):
    """Tilt of the object's base: the angle between vertical and the mean normal (by area) of the downward-facing faces.

    Faces count as downward when their normal points down within acos(facing) of straight down. None when there are none."""
    v = np.asarray(v, float)
    f = np.asarray(f, np.int64)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])  # length = twice the area
    ln = np.linalg.norm(fn, axis=1)
    down = fn[(ln > 1e-12) & (fn[:, 1] < -facing * ln)]
    if len(down) == 0:
        return None
    m = down.sum(0)
    return float(np.degrees(np.arccos(min(1.0, -m[1] / np.linalg.norm(m)))))


def decimate(v, f, max_faces=MAX_FACES):
    """Quadric decimation to at most max_faces (retrying with a lower target, since the simplifier may stop early); drops unused vertices."""
    import fast_simplification as fs
    v = np.asarray(v, float)
    f = np.asarray(f, np.int64)
    target = int(max_faces * 0.97)
    for _ in range(12):
        if len(f) <= max_faces:
            break
        v, f = fs.simplify(v, f, target_count=target, agg=5)
        target = int(target * 0.85)
    if len(f) > max_faces:
        raise RuntimeError(f"could not decimate to {max_faces} faces (stopped at {len(f)})")
    used, inv = np.unique(f, return_inverse=True)
    return v[used], inv.reshape(-1, 3)


def splat_rgb(dc):
    """Gaussian colours from the degree-0 spherical harmonics, 0..1."""
    return np.clip(0.5 + SH_C0 * np.asarray(dc, float).reshape(len(dc), 3), 0, 1)


def vertex_colours(v, splat_xyz, splat_rgb01, splat_opacity=None, k=4):
    """Colour each vertex from its k nearest Gaussians, weighted by 1 / distance and by opacity; uint8 (n, 3)."""
    from scipy.spatial import cKDTree
    xyz = np.asarray(splat_xyz, float)
    rgb = np.asarray(splat_rgb01, float)
    op = np.ones(len(xyz)) if splat_opacity is None else np.asarray(splat_opacity, float).reshape(-1)
    k = min(k, len(xyz))
    d, idx = cKDTree(xyz).query(np.asarray(v, float), k=k)
    d, idx = d.reshape(len(v), k), idx.reshape(len(v), k)
    w = op[idx] / (d + 1e-4)
    w /= w.sum(1, keepdims=True)
    return np.round(np.clip((rgb[idx] * w[..., None]).sum(1), 0, 1) * 255).astype(np.uint8)


def bake(raw_vertices, raw_faces, splat_xyz, splat_dc, splat_opacity, label, typed_height=None, max_faces=MAX_FACES, k=4):
    """Raw lift in, game skin out: (vertices, faces, colours uint8, info) with the object upright on y = 0, centred in x and z."""
    height, source = resolve_height(label, typed_height)
    pose, pinfo = fit_pose(raw_vertices, height)
    v, f = decimate(pose.apply(raw_vertices), raw_faces, max_faces)
    col = vertex_colours(v, pose.apply(splat_xyz), splat_rgb(splat_dc), splat_opacity, k=k)
    lo, hi = v.min(0), v.max(0)
    ext = hi - lo
    tilt = base_tilt_deg(v, f)
    info = {
        "label": label, "extents_m": {"x": round(float(ext[0]), 3), "y": round(float(ext[1]), 3), "z": round(float(ext[2]), 3)},
        "height_m": round(float(ext[1]), 3), "target_height_m": height, "scale_source": source, "scale_factor": pinfo["scale"],
        "raw_height": pinfo["raw_height"], "yaw_deg": pinfo["yaw_deg"], "tilt_deg": None if tilt is None else round(tilt, 2),
        "faces": int(len(f)), "vertices": int(len(v)), "width_to_height": round(float(ext[0] / ext[1]), 3),
    }
    return v, f, col, info
