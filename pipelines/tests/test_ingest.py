import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ingest_video as I  # noqa: E402
from ccpipe import ingest_source as S, vision  # noqa: E402

CC = {"id": "x", "title": "Warped wall run", "description": "side view, pro athlete", "uploader": "Someone", "license": "Creative Commons Attribution license (reuse allowed)", "fps": 30, "duration": 30}


def test_only_cc_by_and_cc0_are_accepted():
    assert S.check_licence(CC)
    assert S.check_licence({"license": "CC0"})
    for bad in (None, "", "Standard YouTube License", "Creative Commons Attribution-NonCommercial", "CC BY-NC-ND 4.0", "CC BY-SA"):
        with pytest.raises(S.Refused):
            S.check_licence({"license": bad})


def test_words_that_point_at_children_stop_the_ingest():
    assert S.screen_text_for_minors(CC) == []
    assert "kids" in S.screen_text_for_minors({**CC, "title": "Ninja KIDS warped wall"})
    assert "junior" in S.screen_text_for_minors({**CC, "tags": ["Junior league"]})
    assert S.screen_text_for_minors({**CC, "description": "ages 8-12 u12 class"}) == ["u12"]


def test_only_a_clear_yes_with_no_child_passes_the_adult_check():
    ok = {"all_adults": "yes", "children_seen": False, "people": 1, "reasons": []}
    assert vision.verdict_from(ok)["pass"]
    for bad in ({**ok, "all_adults": "unsure"}, {**ok, "all_adults": "no"}, {**ok, "children_seen": True}, {"all_adults": "yes"}, None):
        assert not vision.verdict_from(bad)["pass"]
    assert vision.parse_json('text {"all_adults": "yes"} more') == {"all_adults": "yes"}


def test_estimate_states_gpu_minutes_and_dollars_before_the_run():
    e = I.estimate(180, 10)
    assert e["gpu_minutes"] == round((150 + 3.5 * 180) / 60, 1) and e["sam31_images"] == 30
    assert abs(e["usd"]["sam31"] - 0.075) < 1e-9 and e["usd_total"] == round(sum(e["usd"].values()), 3)


def test_edge_points_take_the_side_the_athlete_comes_from():
    mask = np.zeros((10, 10), bool)
    mask[:, 3:8] = True
    left = I.edge_points(mask, 100, 200, +1)
    right = I.edge_points(mask, 100, 200, -1)
    assert (left[:, 0] == 103).all() and (right[:, 0] == 107).all() and left[0, 1] == 200


def test_floor_and_person_undo_the_ten_percent_box_grow():
    # a person 500 px tall with feet at row 1000: the model's box is grown 10 % each way (600 tall, bottom at 1050)
    m = [{"ok": True, "bbox": [100, 450, 300, 1050]}] * 12
    row, h, facing = I.floor_and_person(m, 0, 12)
    assert abs(h - 500) < 1 and abs(row - 1000) < 1 and facing == 1


def test_a_non_cc_video_is_refused_with_a_readme_and_no_work_done(tmp_path):
    info = tmp_path / "i.json"
    info.write_text(json.dumps({**CC, "license": "Standard YouTube License"}))
    code = I.main(["https://example.invalid/v", "--start", "1", "--end", "5", "--id", "t1", "--info-json", str(info), "--eval-dir", str(tmp_path)])
    run = json.loads((tmp_path / "t1/run.json").read_text())
    readme = (tmp_path / "t1/README.md").read_text()
    assert code == 3 and "licence" in run["skipped"] and readme.index("## So what") < readme.index("## Source")
    assert "skipped" in readme.lower()


def test_children_in_the_text_skip_the_segment_before_any_frame_is_touched(tmp_path):
    info = tmp_path / "i.json"
    info.write_text(json.dumps({**CC, "title": "Kids ninja course"}))
    code = I.main(["https://example.invalid/v", "--start", "1", "--end", "5", "--id", "t2", "--info-json", str(info), "--eval-dir", str(tmp_path)])
    assert code == 3 and "possible children" in json.loads((tmp_path / "t2/run.json").read_text())["skipped"]


def test_the_cost_guard_stops_before_any_paid_step(tmp_path):
    info = tmp_path / "i.json"
    info.write_text(json.dumps(CC))
    code = I.main(["https://example.invalid/v", "--start", "0", "--end", "10", "--id", "t3", "--info-json", str(info), "--eval-dir", str(tmp_path), "--max-usd", "0.01"])
    run = json.loads((tmp_path / "t3/run.json").read_text())
    assert code == 3 and "above --max-usd" in run["skipped"] and run["estimate"]["usd_total"] > 0.01
    assert run["licence_check"]


def test_source_record_and_checksums(tmp_path):
    rec = S.source_record(CC, "https://example.invalid/v", 1, 5)
    assert rec["uploader"] == "Someone" and rec["range_s"] == [1, 5] and rec["licence"].startswith("Creative Commons")
    (tmp_path / "a.bin").write_bytes(b"abc")
    S.write_sums(tmp_path)
    assert (tmp_path / "SHA256SUMS").read_text().startswith("ba7816bf")
