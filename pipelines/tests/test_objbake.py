import numpy as np
import pytest

from ccpipe import glb, objbake as B, objmask as M, privacy as P

pytest.importorskip("fast_simplification")
pytest.importorskip("scipy")


def box_mesh(sx, sy, sz, n=1, centre=(0, 0, 0)):
    """An axis-aligned box as a triangle mesh, each face cut into n x n quads (so it can be decimated)."""
    verts, faces = [], []
    for axis in range(3):
        for sign in (-1, 1):
            u, v = [a for a in range(3) if a != axis]
            base = len(verts)
            for i in range(n + 1):
                for j in range(n + 1):
                    p = [0.0, 0.0, 0.0]
                    p[axis] = sign * 0.5
                    p[u] = i / n - 0.5
                    p[v] = j / n - 0.5
                    verts.append(p)
            for i in range(n):
                for j in range(n):
                    a, b, c, d = (base + i * (n + 1) + j, base + i * (n + 1) + j + 1, base + (i + 1) * (n + 1) + j, base + (i + 1) * (n + 1) + j + 1)
                    faces += [[a, b, d], [a, d, c]]
    verts, faces = np.array(verts), np.array(faces)
    c = verts[faces].mean(1)  # on a box centred at the origin, an outward face has its normal along its centroid
    nrm = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    flip = np.einsum("ij,ij->i", nrm, c) < 0
    faces[flip] = faces[flip][:, [0, 2, 1]]
    return verts * np.array([sx, sy, sz]) + np.array(centre), faces


def rotz(v, deg):  # about the lift's vertical axis (z)
    a = np.radians(deg)
    R = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    return v @ R.T


# ---- size ----
def test_typed_height_wins_then_typical_then_default():
    assert B.resolve_height("bench", 0.5) == (0.5, "typed")
    assert B.resolve_height("Handrail") == (1.0, "typical:handrail")
    assert B.resolve_height("low wall") == (0.9, "typical:low wall")
    assert B.resolve_height("gazebo") == (B.DEFAULT_HEIGHT, "default")
    with pytest.raises(ValueError):
        B.resolve_height("bench", 12)


# ---- upright, side-on, on the ground ----
def test_pose_stands_a_lift_that_uses_z_as_up_on_the_ground_at_the_typed_height():
    # a bench-like slab 3 long (x), 1 deep (y), 0.8 tall (z) in the lift's frame, floating at z = 5, off-centre
    v, _ = box_mesh(3, 1, 0.8, centre=(10, -4, 5))
    pose, info = B.fit_pose(v, 0.45)
    w = pose.apply(v)
    assert abs(np.ptp(w[:, 1]) - 0.45) < 1e-9 and abs(w[:, 1].min()) < 1e-9
    assert abs((w[:, 0].min() + w[:, 0].max()) / 2) < 1e-9 and abs((w[:, 2].min() + w[:, 2].max()) / 2) < 1e-9
    assert abs(np.ptp(w[:, 0]) - 3 * 0.45 / 0.8) < 1e-6 and abs(np.ptp(w[:, 2]) - 1 * 0.45 / 0.8) < 1e-6


@pytest.mark.parametrize("turn", [0, 25, 70, 90, 133, 200, 300])
def test_widest_side_ends_up_along_x_whatever_the_turn(turn):
    v, _ = box_mesh(4, 1, 1)
    w = B.fit_pose(rotz(v, turn), 1.0)[0].apply(rotz(v, turn))
    assert np.ptp(w[:, 0]) > 3.9 and np.ptp(w[:, 2]) < 1.1  # 4 long along x, 1 deep along z


def test_up_stays_up_the_camera_layout_is_not_applied():
    # a post 0.2 x 0.2 x 2 (z up): after the bake it is a vertical post, not tilted by anything
    v, f = box_mesh(0.2, 0.2, 2)
    w = B.fit_pose(v, 1.0)[0].apply(v)
    assert np.ptp(w[:, 1]) > 0.99 and np.ptp(w[:, 0]) < 0.11
    assert B.base_tilt_deg(w, f) < 1e-6


def test_base_tilt_sees_a_tilted_base():
    a = np.radians(12)
    R = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    flat, f = box_mesh(2, 0.3, 2, n=8)  # y up already: flat base
    assert B.base_tilt_deg(flat, f) < 0.5
    assert abs(B.base_tilt_deg(flat @ R.T, f) - 12) < 0.5


# ---- light ----
def test_decimate_caps_faces_and_keeps_the_shape():
    v, f = box_mesh(2, 1, 0.5, n=40)  # 6 * 40 * 40 * 2 = 19,200 faces
    assert len(f) == 19200
    v2, f2 = B.decimate(v, f, 6000)
    assert len(f2) <= 6000 and f2.max() < len(v2)
    assert np.allclose(np.ptp(v2, axis=0), [2, 1, 0.5], atol=1e-6)


def ellipsoid(rx, ry, rz, n=120):
    """A closed smooth surface like a lift's (one watertight skin), 2 * n * (n - 1) faces."""
    th = np.linspace(0, np.pi, n + 1)
    ph = np.linspace(0, 2 * np.pi, 2 * n, endpoint=False)
    T, Ph = np.meshgrid(th, ph, indexing="ij")
    v = np.stack([rx * np.sin(T) * np.cos(Ph), ry * np.sin(T) * np.sin(Ph), rz * np.cos(T)], -1).reshape(-1, 3)
    f = []
    m = 2 * n
    for i in range(n):
        for j in range(m):
            a, b = i * m + j, i * m + (j + 1) % m
            c, d = (i + 1) * m + j, (i + 1) * m + (j + 1) % m
            if i > 0:
                f.append([a, c, b])
            if i < n - 1:
                f.append([b, c, d])
    return v, np.array(f)


def test_decimate_a_smooth_closed_surface_keeps_its_size_and_never_exceeds_the_cap():
    v, f = ellipsoid(1.5, 0.5, 0.4)
    assert len(f) > 40000
    v2, f2 = B.decimate(v, f, 6000)
    assert 3000 < len(f2) <= 6000
    assert np.allclose(np.ptp(v2, axis=0), np.ptp(v, axis=0), rtol=0.02)


def test_decimate_leaves_small_meshes_alone():
    v, f = box_mesh(1, 1, 1, n=2)
    v2, f2 = B.decimate(v, f, 6000)
    assert len(f2) == len(f) and len(v2) == len(np.unique(f))


# ---- colour ----
def test_colour_comes_from_the_nearest_gaussians():
    xyz = np.array([[0, 0, 0], [10, 0, 0.0]])
    rgb = np.array([[1, 0, 0], [0, 0, 1.0]])
    col = B.vertex_colours(np.array([[0.1, 0, 0], [9.9, 0, 0]]), xyz, rgb, k=1)
    assert col.tolist() == [[255, 0, 0], [0, 0, 255]]


def test_colour_mixes_by_distance_and_opacity():
    xyz = np.array([[0, 0, 0], [2, 0, 0.0]])
    rgb = np.array([[1, 0, 0], [0, 0, 1.0]])
    mid = B.vertex_colours(np.array([[1.0, 0, 0]]), xyz, rgb, k=2)[0]
    assert abs(int(mid[0]) - int(mid[2])) <= 1  # equidistant, equal opacity: an even mix
    dim = B.vertex_colours(np.array([[1.0, 0, 0]]), xyz, rgb, np.array([1.0, 0.25]), k=2)[0]
    assert dim[0] > 3 * dim[2]  # the see-through Gaussian counts for less


def test_splat_colour_from_spherical_harmonics_dc():
    assert np.allclose(B.splat_rgb(np.zeros((1, 3))), 0.5)
    assert np.allclose(B.splat_rgb(np.full((1, 3), 10.0)), 1.0)


# ---- the whole bake ----
def test_bake_meets_the_pass_lines_on_a_heavy_mesh(tmp_path):
    v, f = box_mesh(3, 1, 0.9, n=50, centre=(1, 2, 3))  # 30,000 faces
    rng = np.random.default_rng(0)
    xyz = rng.uniform(-0.5, 0.5, (4000, 3)) * np.array([3, 1, 0.9]) + np.array([1, 2, 3])
    dc = (xyz[:, :1] > 1) * np.array([[2.0, -2.0, -2.0]]) + (xyz[:, :1] <= 1) * np.array([[-2.0, -2.0, 2.0]])
    vb, fb, cb, info = B.bake(v, f, xyz, dc, np.ones(4000), "low wall")
    assert info["faces"] <= 6000 and abs(info["height_m"] - 0.9) / 0.9 < 0.1 and info["tilt_deg"] < 5
    assert info["scale_source"] == "typical:low wall" and abs(info["extents_m"]["x"] - 3.0) < 0.01
    out = tmp_path / "o.glb"
    size = glb.write_glb(out, vb, fb, cb)
    assert size < 1.5e6 and out.stat().st_size == size
    # red on one end, blue on the other: the colours followed the mesh through the pose
    left, right = cb[vb[:, 0] < -0.5], cb[vb[:, 0] > 0.5]
    assert left[:, 2].mean() > 200 > left[:, 0].mean() and right[:, 0].mean() > 200 > right[:, 2].mean()


# ---- GLB ----
def test_glb_round_trip(tmp_path):
    v, f = box_mesh(1, 2, 3, n=3)
    col = np.tile(np.array([[255, 128, 0]], np.uint8), (len(v), 1))
    p = tmp_path / "a.glb"
    glb.write_glb(p, v, f, col, name="thing")
    v2, f2, c2, doc = glb.read_glb(p)
    assert np.allclose(v2, v, atol=1e-6) and (f2 == f).all()
    assert doc["asset"]["version"] == "2.0" and doc["nodes"][0]["name"] == "thing"
    acc = doc["accessors"][doc["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
    assert np.allclose(acc["min"], v.min(0), atol=1e-6) and np.allclose(acc["max"], v.max(0), atol=1e-6)
    assert c2[0].tolist() == [255, round(glb.srgb_to_linear(128 / 255) * 255), 0]  # stored linear


def test_glb_normals_point_outward_on_a_box(tmp_path):
    v, f = box_mesh(2, 2, 2, n=2)
    n = glb.vertex_normals(v, f)
    assert np.allclose(np.linalg.norm(n, axis=1), 1)
    assert (np.einsum("ij,ij->i", n, v) > 0).all()


def test_glb_is_four_byte_aligned_and_has_the_stated_length(tmp_path):
    v, f = box_mesh(1, 1, 1, n=1)
    p = tmp_path / "b.glb"
    glb.write_glb(p, v, f)  # no colours is allowed
    data = p.read_bytes()
    assert len(data) % 4 == 0 and int.from_bytes(data[8:12], "little") == len(data)


# ---- mask choice ----
def mk(shape, box):
    return M.box_mask(shape, box)


def test_pick_mask_takes_the_best_overlap_and_breaks_ties_by_score():
    shape = (100, 200)
    cands = [{"mask": mk(shape, [0, 0, 50, 50]), "score": 0.9}, {"mask": mk(shape, [58, 8, 150, 90]), "score": 0.5},
             {"mask": mk(shape, [60, 10, 150, 90]), "score": 0.7}]
    i, o = M.pick_mask(cands, [60, 10, 150, 90])
    assert i == 2 and o == 1.0


def test_pick_mask_gives_none_when_nothing_overlaps_enough():
    shape = (100, 200)
    assert M.pick_mask([{"mask": mk(shape, [0, 0, 20, 20]), "score": 0.9}], [100, 50, 190, 95]) == (None, 0.0)
    assert M.pick_mask([], [0, 0, 5, 5]) == (None, 0.0)


def test_box_mask_fallback_covers_the_box():
    m = M.box_mask((50, 80), [10, 5, 30, 25])
    assert m.sum() == 20 * 20 and M.mask_box(m) == [10, 5, 30, 25]


# ---- privacy ----
def test_privacy_blurs_people_pixelates_faces_and_counts():
    rng = np.random.default_rng(1)
    img = rng.integers(0, 255, (200, 300, 3), dtype=np.uint8)
    person = np.zeros((200, 300), bool)
    person[40:180, 60:140] = True
    face = np.zeros((200, 300), bool)
    face[50:90, 80:120] = True
    out, rc = P.apply_privacy(img, [person], [face], [])
    assert rc == {"people": 1, "faces": 1, "plates": 0, "changed": True}
    assert (out[:30] == img[:30]).all() and (out[:, 250:] == img[:, 250:]).all()  # the rest is untouched
    body = out[100:170, 70:130].astype(float)
    assert body.std() < 0.5 * img[100:170, 70:130].astype(float).std()  # blurred: much less detail
    blocks = out[55:85, 85:115]
    assert len(np.unique(blocks.reshape(-1, 3), axis=0)) < 40  # pixelated into a few flat squares


def test_privacy_with_nobody_changes_nothing():
    img = np.random.default_rng(2).integers(0, 255, (60, 80, 3), dtype=np.uint8)
    out, rc = P.apply_privacy(img, [], [], [])
    assert (out == img).all() and rc["changed"] is False
