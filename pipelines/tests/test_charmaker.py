"""The character pipeline (CC-108): rig laws, size caps, the retry rule and the fallback, with mock providers (no network, no GPU)."""
import io
import struct

import numpy as np
import pytest

from charmaker import limits, maker, package, rig as rt, route_c
from charmaker.contracts import NotConfigured, Request, STAGES, StepFailed
from charmaker.mock import MockMaker, fake_mask, fake_picture
from charmaker.providers import PROVIDERS
from charmaker.providers.route_a import RouteAMaker
from charmaker.providers.tripo import TripoMaker

T = rt.Template()


@pytest.fixture(scope="module")
def baked():
    return route_c.rookie_in_your_colours(fake_picture(), fake_mask())


@pytest.fixture(scope="module")
def made(baked):
    return package.package(baked, fake_picture(), fake_mask(), {"prompt": "x"}, T)


# ---- rig laws ----
def test_template_has_34_bones():
    assert len(T.names) == 34 == limits.BONES


def test_every_vertex_is_weighted_and_weights_sum_to_one(baked):
    V, _ = rt.fit_to_template(T, baked.v)
    joints, weights = rt.nearest_bone_weights(T, V)
    assert rt.weight_problems(joints, weights) == []
    assert joints.max() < 34 and np.allclose(weights.sum(1), 1, atol=1e-3) and (weights.max(1) > 0).all()


def test_rest_pose_stretches_nothing(baked):
    V, _ = rt.fit_to_template(T, baked.v)
    j, w = rt.nearest_bone_weights(T, V)
    s = rt.edge_stretch(T, V, baked.f, j, w, {"rest": []})
    assert abs(s["rest"][0] - 1) < 1e-6 and abs(s["rest"][2] - 1) < 1e-6


def test_edge_stretch_is_bounded_on_three_poses(made):
    _, rigged = made
    for name, (mean, p99, worst) in rigged.stretch.items():
        assert mean < 1.15, (name, mean)      # the 8 live characters measured 1.03 to 1.24 mean
        assert p99 < 3.0, (name, p99)


def test_bad_weights_are_caught():
    j = np.zeros((2, 4), np.uint8); w = np.array([[0.5, 0, 0, 0], [0.25, 0.25, 0.25, 0.25]], np.float32)
    assert "some vertex weights do not sum to 1" in rt.weight_problems(j, w)
    assert "a joint index is not a bone" in rt.weight_problems(j + 40, w)


def test_fit_keeps_the_height_of_the_rookie():
    V = np.random.RandomState(1).rand(500, 3) * [0.3, 3.5, 0.2]
    out, s = rt.fit_to_template(T, V)
    assert abs(out[:, 1].max() - 1.75) < 1e-6 and out[:, 1].min() == 0


# ---- size caps ----
def test_the_packed_character_fits_every_cap(made):
    pkg, rigged = made
    assert limits.glb_problems(pkg.glb, T.names) == []
    assert len(pkg.glb) <= limits.MAX_GLB_BYTES and rigged.faces <= limits.MAX_FACES
    assert len(pkg.thumb_webp) <= limits.MAX_THUMB_BYTES and pkg.thumb_webp[:4] == b"RIFF"
    assert pkg.id == __import__("hashlib").sha256(pkg.glb).hexdigest()[:16]


def test_caps_refuse_what_is_too_big(made):
    glb = made[0].glb
    assert any("bytes" in p for p in limits.glb_problems(glb + b"\0" * limits.MAX_GLB_BYTES))
    assert limits.glb_problems(b"nope") == ["not a readable glb"]
    j, bin_ = limits.read_glb(glb)
    j["animations"] = [{}]
    assert "has animations" in problems_of(j, bin_)
    j["animations"] = []; j["skins"][0]["joints"] = j["skins"][0]["joints"][:30]
    assert any("30 bones" in p for p in problems_of(j, bin_))


def problems_of(j, bin_):
    import json
    js = json.dumps(j).encode(); js += b" " * (-len(js) % 4)
    out = struct.pack("<4sII", b"glTF", 2, 20 + len(js) + 8 + len(bin_)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(bin_), b"BIN\0") + bin_
    return limits.glb_problems(out)


def test_a_big_texture_or_many_faces_is_refused(baked):
    big = package.rig_baked(baked, T, tex_px=512)[0].glb
    assert any("texture" in p for p in limits.glb_problems(big)) or len(big) > limits.MAX_GLB_BYTES
    import copy
    many = copy.copy(baked)
    from charmaker import objbake_shim as ob
    v, f, uv = ob.unwrap(*ob.decimate(T.v, rt.acc(T.j, T.bin, T.j["meshes"][0]["primitives"][0]["indices"]).reshape(-1, 3).astype(np.int64), 5000))
    many.v, many.f, many.uv = v, f, uv
    many.tex = baked.tex
    with pytest.raises(Exception):
        package.package(many, fake_picture(), None, {}, T)


# ---- the pipeline ----
def run(m, **kw):
    seen = []
    res = maker.run(m, Request("a fox", seed=42), lambda s, i: seen.append((s, i)), T, **kw)
    return res, seen


def test_stages_come_in_order_and_cost_adds_up():
    m = MockMaker()
    res, seen = run(m)
    order = []
    for s, _ in seen:
        if s not in order:
            order.append(s)
    assert order == STAGES
    assert res.route == "A" and res.provider == "mock"
    assert abs(res.cost_usd - 0.0425) < 1e-9
    assert res.package.meta["route"] == "A" and "owner" in res.package.meta


def test_retry_rule_new_seed_then_sixty_percent():
    m = MockMaker(mesh_fails=2)
    res, _ = run(m)
    meshes = [c for c in m.calls if c[0] == "mesh"]
    assert meshes == [("mesh", 42, 1.0), ("mesh", 43, 1.0), ("mesh", 43, 0.6)]
    assert res.route == "A" and [a["ok"] for a in res.attempts if a["stage"] == "mesh"] == [False, False, True]


def test_one_failure_retries_once_with_a_new_seed():
    m = MockMaker(mesh_fails=1)
    res, _ = run(m)
    assert [c for c in m.calls if c[0] == "mesh"] == [("mesh", 42, 1.0), ("mesh", 43, 1.0)]
    assert res.route == "A"


def test_three_lift_failures_fall_back_to_route_c():
    m = MockMaker(mesh_fails=9)
    res, _ = run(m)
    assert res.route == "C" and len([c for c in m.calls if c[0] == "mesh"]) == 3 and ("fallback",) in m.calls
    assert res.notes and limits.glb_problems(res.package.glb, T.names) == []


def test_no_fallback_means_failure_and_a_refund():
    m = MockMaker(mesh_fails=9, has_fallback=False)
    with pytest.raises(maker.Failed) as e:
        run(m)
    assert e.value.stage == "mesh" and e.value.refund


def test_picture_is_tried_twice():
    assert run(MockMaker(picture_fails=1))[0].route == "A"
    with pytest.raises(maker.Failed):
        run(MockMaker(picture_fails=2))


def test_tripo_slot_says_not_configured():
    t = TripoMaker()
    assert t.configured()
    with pytest.raises(maker.Failed) as e:
        maker.run(t, Request("x"))
    assert "not configured" in e.value.why
    with pytest.raises(NotConfigured):
        t.mesh(None, None, 1, 1.0)
    assert set(PROVIDERS) == {"route-a", "tripo"}


def test_route_a_without_a_key_is_not_configured():
    assert RouteAMaker(env={}).configured()
    assert RouteAMaker(env={"META_API_KEY": "k", "META_BASE_URL": "https://x"}).configured() is None


# ---- route A steps with the network replaced ----
def test_route_a_picture_step_decodes_and_prices():
    import base64
    png = fake_picture()
    seen = {}
    def http(env, path, body):
        seen.update(path=path, body=body)
        return {"data": [{"b64_json": base64.b64encode(png).decode()}]}
    m = RouteAMaker(http=http, env={"META_API_KEY": "k", "META_BASE_URL": "https://x"})
    pic = m.picture(Request("a fox"))
    assert pic.png == png and pic.cost_usd == 0.01
    assert seen["path"] == "/images/generations" and "T-pose" in seen["body"]["prompt"] and seen["body"]["prompt"].startswith("a fox")


def test_route_a_picture_failure_is_a_step_failure():
    def http(env, path, body):
        raise OSError("boom")
    with pytest.raises(StepFailed):
        RouteAMaker(http=http, env={"META_API_KEY": "k", "META_BASE_URL": "https://x"}).picture(Request("x"))


def fake_lift_result():
    prim = T.j["meshes"][0]["primitives"][0]
    f = rt.acc(T.j, T.bin, prim["indices"]).reshape(-1, 3).astype(np.int64)
    v = T.v * 2.0
    raw = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)  # y up -> the lift's z up
    b = io.BytesIO()
    np.savez(b, vertices=raw, faces=f, splat_xyz=raw, splat_dc=np.random.RandomState(0).randn(len(raw), 3) * 0.5, splat_opacity=np.ones(len(raw)))
    return {"npz": b.getvalue(), "seconds": 12.0, "load_seconds": 0.0, "n_faces": len(f), "n_gaussians": len(raw)}


def test_route_a_mesh_step_bakes_and_retries_become_step_failures():
    from charmaker.contracts import Picture, Cutout
    pic, cut = Picture(fake_picture()), Cutout(fake_mask())
    calls = []
    def lift(jpeg, mask, seed):
        calls.append(seed)
        return fake_lift_result()
    m = RouteAMaker(lift=lift)
    b = m.mesh(pic, cut, 7, 0.6)
    assert calls == [7] and len(b.f) <= 3000 and abs(b.cost_usd - 12 * 1.95 / 3600) < 1e-3
    def broken(jpeg, mask, seed):
        raise ConnectionError("dropped")
    with pytest.raises(StepFailed):
        RouteAMaker(lift=broken).mesh(pic, cut, 7, 1.0)
