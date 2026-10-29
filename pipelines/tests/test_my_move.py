"""My move (CC-222): the clip the pipeline writes has the shipped format, and 'playable' means both checks passed."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ccpipe import movecheck  # noqa: E402
from ccpipe.clip import Clip  # noqa: E402
from ccpipe.skeleton import NAMES, PARENTS  # noqa: E402
import my_move  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SHIPPED = json.loads((REPO / "public/assets/motion/roll.json").read_text())


def test_id_rule_blocks_paths():
    assert my_move.ID_RE.match("roll-lp")
    assert not my_move.ID_RE.match("../x")
    assert not my_move.ID_RE.match("Roll")


def test_move_has_a_check():
    assert my_move.MOVES["roll"] in movecheck.CHECKS


def test_my_move_files_match_the_shipped_format_and_playable_means_both_checks():
    files = sorted((REPO / "public/assets/experiments/mymove").glob("*.json"))
    for f in files:
        d = json.loads(f.read_text())
        assert d["names"] == SHIPPED["names"] == list(NAMES)
        assert d["parents"] == SHIPPED["parents"] == list(PARENTS)
        assert all(len(fr) == len(d["names"]) for fr in d["frames"])
        assert d["fps"] > 0 and len(d["frames"]) >= 10
        if d.get("kind") == "my-move-diagnostic":      # an unchecked clip for the diagnostic strip: never playable
            assert d["playable"] is False
        else:
            assert d["playable"] == bool(d["gate"]["pass"] and d["move_check"]["ok"])
        Clip.from_json(d)
