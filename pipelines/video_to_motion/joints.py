"""The 30 joints (Kimodo's SOMA model skeleton) and small helpers; the skeleton itself lives in ccpipe."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ccpipe.skeleton import IDX, NAMES, PARENTS  # noqa: E402,F401


def j(a, name):
    """a: (T,30,3) -> (T,3) for joint name"""
    return a[:, IDX[name]]


def speeds(p, times):
    """per-frame speed (m/s) of a (T,3) track, central differences on the clip's own times"""
    t = np.asarray(times)
    v = np.gradient(p, t, axis=0)
    return np.linalg.norm(v, axis=1)
