import json
from pathlib import Path

import numpy as np
import pytest

from ccpipe import primitives as P

jsonschema = pytest.importorskip("jsonschema")
SCHEMA = json.loads((Path(__file__).resolve().parents[2] / "course/primitives.schema.json").read_text())


def valid(prims):
    doc = {"schemaVersion": "0.1.0", "primitives": prims}
    jsonschema.Draft202012Validator(SCHEMA).validate(doc)


def det(phrase, box, **kw):
    return {"phrase": phrase, "box": box, "score": 0.9, "mask_px": 5000, "frames": [0], **kw}


def test_known_height_scale_gives_a_wall_its_metres_and_an_uncertainty():
    scale = P.scale_known_height(4.3, 860)          # 200 px per metre
    assert abs(scale["metresPerPixel"] - 0.005) < 1e-9
    p = P.fit(det("curved wall", [100, 100, 700, 960]), scale, floor_row_px=960)
    assert p["type"] == "ramp" and p["sizes"]["profile"] == "arc" and abs(p["sizes"]["height"] - 4.3) < 0.01
    assert p["scale"]["source"] == "known-height" and 0.04 <= p["sizeUncertainty"]["height"] < 0.06
    valid([p])


def test_arc_radius_comes_from_the_edge_points_when_given():
    th = np.linspace(0, np.pi / 2, 40)
    edge = np.c_[500 + 300 * np.cos(th), 100 + 300 * np.sin(th)]   # a circle of radius 300 px
    scale = P.scale_known_height(4.3, 860)
    p = P.fit(det("warped wall", [200, 100, 800, 960]), scale, 960, edge_points_px=edge)
    assert abs(p["sizes"]["radius"] - 300 * scale["metresPerPixel"]) < 0.02 and "fitted" in p["fit"]["note"]
    valid([p])
    guess = P.fit(det("warped wall", [200, 100, 800, 960]), scale, 960)
    assert guess["sizeUncertainty"]["radius"] >= 0.3 and "guessed" in guess["fit"]["note"]


def test_body_height_scale_is_looser_than_a_known_height():
    body = P.scale_body_height(400)
    known = P.scale_known_height(4.3, 860)
    assert body["relativeUncertainty"] > 1.5 * known["relativeUncertainty"] and body["source"] == "body-height"


def test_every_type_a_phrase_can_become_is_valid_against_the_schema():
    scale = P.scale_body_height(300)
    phrases = ["wall", "ramp", "platform", "bar", "rope", "ledge", "box", "water", "trampoline", "curved wall"]
    prims = [P.fit(det(ph, [50, 100, 250, 400]), scale, 450, idx=i) for i, ph in enumerate(phrases)]
    assert all(prims)
    valid(prims)
    assert {p["type"] for p in prims} == {"wall", "ramp", "platform", "bar", "ropeAnchor", "water", "spring"}
    assert next(p for p in prims if p["type"] == "bar")["status"] == "proposed"


def test_unknown_phrases_make_no_primitive():
    assert P.primitive_for_phrase("banana") is None
    assert P.fit(det("banana", [0, 0, 10, 10]), P.scale_body_height(300), 10) is None


def test_overlapping_detections_of_one_phrase_merge_and_frames_are_kept():
    ds = [det("wall", [0, 0, 100, 200], frames=[1]), det("wall", [5, 0, 105, 200], frames=[9], score=0.5), det("wall", [400, 0, 500, 200])]
    m = P.merge_detections(ds)
    assert len(m) == 2 and m[0]["frames"] == [1, 9]


def test_schema_rejects_an_arc_without_a_radius_and_a_missing_size():
    scale = P.scale_body_height(300)
    p = P.fit(det("curved wall", [0, 0, 100, 200]), scale, 200)
    del p["sizes"]["radius"]
    with pytest.raises(jsonschema.ValidationError):
        valid([p])
    w = P.fit(det("wall", [0, 0, 100, 200]), scale, 200)
    del w["sizes"]["height"]
    with pytest.raises(jsonschema.ValidationError):
        valid([w])


def test_gaps_between_platforms_and_contact_check():
    a = {"id": "platform-1", "type": "platform", "pose": {"x": 0, "z": 0}, "sizes": {"length": 2, "height": 1.0, "width": 2}}
    b = {"id": "platform-2", "type": "platform", "pose": {"x": 0, "z": 6}, "sizes": {"length": 2, "height": 1.2, "width": 2}}
    g = P.gaps_between([b, a])
    assert len(g) == 1 and abs(g[0]["sizes"]["span"] - 4.0) < 1e-9 and abs(g[0]["sizes"]["drop"] - 0.2) < 1e-9
    valid(g)
    wall = P.fit(det("wall", [0, 0, 100, 400]), P.scale_known_height(2.0, 400), 400)
    ok = P.check_with_contacts(wall, [{"kind": "obstacle", "joint": "LeftHand", "point": [0, 1.9, 0]}])
    bad = P.check_with_contacts(wall, [{"kind": "obstacle", "joint": "LeftHand", "point": [0, 3.5, 0]}])
    assert ok["consistent"] and not bad["consistent"]


def test_an_oblique_view_trusts_heights_only():
    scale = P.scale_body_height(300)
    side = P.fit(det("wall", [0, 100, 900, 400]), scale, 400, view="side")
    obl = P.fit(det("wall", [0, 100, 900, 400]), scale, 400, view="oblique")
    assert side["sizes"]["thickness"] > 1.5 and obl["sizes"]["thickness"] == P.TYPICAL_THICKNESS_M
    assert side["sizes"]["height"] == obl["sizes"]["height"] and obl["sizeUncertainty"]["thickness"] == 0.5
    assert "oblique" in obl["fit"]["note"]
    valid([obl])


def test_keep_best_drops_specks_and_caps_each_phrase():
    ds = [det("pole", [0, 0, 5, 5], mask_px=10)] + [det("ledge", [i * 50, 0, i * 50 + 40, 40], mask_px=1000 + i, score=0.5 + i / 100) for i in range(6)]
    kept = P.keep_best(ds, image_px=100_000)
    assert [d["phrase"] for d in kept].count("ledge") == 3 and not any(d["phrase"] == "pole" for d in kept)
    assert min(d["mask_px"] for d in kept) >= 1003
