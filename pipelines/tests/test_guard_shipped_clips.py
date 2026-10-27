"""Guard: every clip in the game's motion folder passes the plausibility gate, is credited and listed in docs/ASSETS.md;
experiment clips never sit among shipped ones."""
import glob
import json
import os

import pytest

from ccpipe import gate
from ccpipe.clip import Clip

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOTION = os.path.join(ROOT, "public", "assets", "motion")
EXPERIMENTS = os.path.join(ROOT, "public", "assets", "experiments")
SHIPPED = sorted(glob.glob(os.path.join(MOTION, "*.json")))
STARTER = {"run", "leap", "land", "hang", "swing", "wall_runup_grab"}


def test_there_are_shipped_clips():
    assert SHIPPED, "no clips in public/assets/motion"


@pytest.mark.parametrize("path", SHIPPED, ids=[os.path.basename(p) for p in SHIPPED])
def test_shipped_clip_passes_the_gate(path):
    clip = Clip.load(path)
    report = gate.run_gate(clip)
    assert report["pass"], f"{os.path.basename(path)} fails: {gate.failures(report)}"
    assert "credit" in clip.meta and clip.meta["credit"], "every clip carries its credit line"


@pytest.mark.parametrize("path", SHIPPED, ids=[os.path.basename(p) for p in SHIPPED])
def test_shipped_clip_has_an_assets_row(path):
    with open(os.path.join(ROOT, "docs", "ASSETS.md")) as f:
        assets = f.read()
    assert os.path.basename(path) in assets, f"{os.path.basename(path)} has no row in docs/ASSETS.md"


def test_experiment_clips_stay_out_of_the_motion_folder():
    names = {os.path.basename(p) for p in glob.glob(os.path.join(EXPERIMENTS, "**", "*.json"), recursive=True)}
    assert not names & {os.path.basename(p) for p in SHIPPED}, "an experiment clip is among the shipped ones"


# Starter moves still without a shipped clip (CC-17: Kimodo's text-only wall run-up never passed the fixed line, see
# data/eval/starter-clips/README.md; CC-17 round 2 with the simulator's path and contact targets also failed, see data/eval/cc-17-wall/README.md). the move is reported as xfail; when one ships, test_open_moves_really_are_open fails until it is removed here.
OPEN_MOVES = {"wall_runup_grab"}


@pytest.mark.parametrize("move", sorted(STARTER))
def test_every_starter_move_has_a_shipped_clip(move):
    if move in OPEN_MOVES:
        pytest.xfail(f"{move}: no candidate passed yet")
    moves = {Clip.load(p).meta.get("move") for p in SHIPPED}
    assert move in moves, f"no shipped clip for the starter move {move}"


def test_open_moves_really_are_open():
    shipped = {Clip.load(p).meta.get("move") for p in SHIPPED}
    assert not OPEN_MOVES & shipped, "a move in OPEN_MOVES now ships: remove it from OPEN_MOVES"
