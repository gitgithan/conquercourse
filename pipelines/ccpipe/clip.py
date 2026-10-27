"""Clip file: {"names", "parents", "fps", "frames": [frame][joint][x, y, z]} in metres, y up, run along +z, left on +x."""
import json
from dataclasses import dataclass, field

import numpy as np

from .skeleton import NAMES, PARENTS


@dataclass
class Clip:
    frames: np.ndarray  # (T, 30, 3)
    fps: float
    names: list = field(default_factory=lambda: list(NAMES))
    parents: list = field(default_factory=lambda: list(PARENTS))
    meta: dict = field(default_factory=dict)  # gravity, takeoff, landing, supportedBy, geometry, credit, gate ...

    def __post_init__(self):
        self.frames = np.asarray(self.frames, dtype=float)
        assert self.frames.ndim == 3 and self.frames.shape[2] == 3, self.frames.shape
        assert len(self.names) == self.frames.shape[1], (len(self.names), self.frames.shape)
        assert len(self.parents) == len(self.names)
        assert self.fps > 0

    @property
    def n(self):
        return self.frames.shape[0]

    @property
    def times(self):
        return np.arange(self.n) / self.fps

    def copy(self, frames=None, **meta):
        return Clip(self.frames.copy() if frames is None else frames, self.fps, list(self.names),
                    list(self.parents), {**self.meta, **meta})

    def to_json(self):
        d = {"names": self.names, "parents": self.parents, "fps": self.fps,
             "frames": np.round(self.frames, 4).tolist()}
        d.update(self.meta)
        return d

    def save(self, path):
        with open(path, "w") as f:
            json.dump(self.to_json(), f, separators=(",", ":"))

    @staticmethod
    def from_json(d):
        d = dict(d)
        names, parents, fps, frames = d.pop("names"), d.pop("parents"), d.pop("fps"), d.pop("frames")
        return Clip(np.array(frames), fps, names, parents, d)

    @staticmethod
    def load(path):
        with open(path) as f:
            return Clip.from_json(json.load(f))
