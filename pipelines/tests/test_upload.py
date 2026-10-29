"""Checks on a player's upload (CC-221): refused early with a plain reason, accepted when clean."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ccpipe import upload

JPG = b"\xff\xd8\xff" + b"0" * 100


def test_clean_request_is_accepted_and_normalised():
    clean, why = upload.check(JPG, "  Trash   Bin ", [10.2, 10, 300, 200], "0.9", (640, 480))
    assert why is None and clean == {"label": "trash bin", "box": [10, 10, 300, 200], "height_m": 0.9}


def test_height_is_optional():
    clean, _ = upload.check(JPG, "bench", [0, 0, 100, 100], None, (640, 480))
    assert clean["height_m"] is None


def test_refusals_say_why():
    assert upload.check(b"nope", "bench", [0, 0, 100, 100], None, (640, 480))[1] == "the photo must be a jpeg"
    assert "box" in upload.check(JPG, "bench", [0, 0, 5, 5], None, (640, 480))[1]
    assert "box" in upload.check(JPG, "bench", [0, 0, 700, 100], None, (640, 480))[1]
    assert "height" in upload.check(JPG, "bench", [0, 0, 100, 100], 9, (640, 480))[1]
    assert "few letters" in upload.check(JPG, "3d printer!!", [0, 0, 100, 100], None, (640, 480))[1]
    assert "size" in upload.check(JPG, "bench", [0, 0, 100, 100], None, (9000, 480))[1]
    assert "big" in upload.check(JPG + b"0" * 3_000_000, "bench", [0, 0, 100, 100], None, (640, 480))[1]
