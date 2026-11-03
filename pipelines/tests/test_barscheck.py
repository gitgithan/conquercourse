"""CC-133: the bar checks pass the procedural bar clips and fail clips that are not that move (negative controls)."""
import json
import os

import numpy as np
import pytest

from ccpipe import barscheck, gate
from ccpipe.clip import Clip
from synth import standing

HERE = os.path.dirname(os.path.abspath(__file__))
BARS = os.path.join(HERE, "..", "..", "public", "assets", "experiments", "bars")


def load(name):
    with open(os.path.join(BARS, f"bars_{name}.json")) as f:
        d = json.load(f)
    return Clip(np.array(d["frames"], dtype=float), d["fps"], meta=d.get("meta", {}))


@pytest.mark.parametrize("kind", ["travel", "idle", "kip"])
def test_the_bar_clip_passes_the_gate_and_its_own_check(kind):
    clip = load(kind)
    assert gate.run_gate(clip)["pass"]
    assert barscheck.CHECKS[kind](clip)[0]


@pytest.mark.parametrize("kind", ["travel", "idle", "kip"])
def test_a_standing_body_is_not_a_bar_move(kind):
    assert not barscheck.CHECKS[kind](standing(speed=0.0))[0]


def test_a_hang_is_not_travel():
    assert not barscheck.CHECKS["travel"](load("idle"))[0]
