"""The slots of the character pipeline (CC-108): picture -> cutout -> mesh -> rig -> package.

A provider (`CharacterMaker`) fills the slots it can. The first three slots (picture, cutout, mesh) are where makers differ; rig and package are ours and shared,
so a mesh from any provider ends as the same 34-bone character. A slot a provider cannot fill raises NotConfigured (Tripo today) or StepFailed (a real failure, may be retried)."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np

STAGES = ["picture", "cutout", "mesh", "rig", "package"]
STAGE_WORDS = {  # what the player reads
    "picture": "Drawing your character",
    "cutout": "Cutting it out",
    "mesh": "Building the 3D shape",
    "rig": "Fitting it to the runner's bones",
    "package": "Checking the size and packing it",
}


class NotConfigured(Exception):
    """The provider has no key or no account here; the pipeline tries the next one or stops with a plain sentence."""


class StepFailed(Exception):
    """A step failed in a way another try may fix (a dropped connection, a bad mask)."""


class Refused(Exception):
    """A step failed in a way another try cannot fix (the picture is unusable, a size cap is broken)."""


@dataclass
class Request:
    prompt: str
    seed: int = 42
    owner: str = ""       # a one-way player code, never an address


@dataclass
class Picture:
    png: bytes
    seconds: float = 0.0
    cost_usd: float = 0.0


@dataclass
class Cutout:
    mask_png: bytes
    score: float = 0.0
    seconds: float = 0.0
    cost_usd: float = 0.0


@dataclass
class Baked:
    """A coloured, upright mesh: y up, feet on y = 0, facing +z, unit metres. `rig` fits it into the Rookie's box."""
    v: np.ndarray
    f: np.ndarray
    uv: np.ndarray
    tex: np.ndarray       # uint8 (n, n, 3)
    info: dict = field(default_factory=dict)
    seconds: float = 0.0
    cost_usd: float = 0.0


@dataclass
class Rigged:
    glb: bytes
    faces: int
    verts: int
    stretch: dict
    seconds: float = 0.0


@dataclass
class Package:
    id: str               # first 16 hex characters of the glb's SHA-256: a content name, so a browser can cache it for ever
    glb: bytes
    thumb_webp: bytes
    meta: dict


class CharacterMaker:
    """Base class. Subclasses override what they can; the defaults for rig and package are ours."""
    id = "base"
    label = "base"

    def configured(self) -> Optional[str]:
        """None when ready, else the reason it is not (shown to the owner, never to a player)."""
        return None

    def picture(self, req: Request) -> Picture:
        raise NotConfigured(f"{self.id} does not draw pictures")

    def cutout(self, pic: Picture) -> Cutout:
        raise NotConfigured(f"{self.id} does not cut out figures")

    def mesh(self, pic: Picture, cut: Cutout, seed: int, scale: float) -> Baked:
        raise NotConfigured(f"{self.id} does not build meshes")

    def fallback(self, pic: Picture, cut: Optional[Cutout]) -> Optional[Baked]:
        """Route C: a body that needs no lift (None when the provider has none)."""
        return None


Progress = Callable[[str, dict], None]
