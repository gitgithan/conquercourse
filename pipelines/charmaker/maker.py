"""The pipeline runner (CC-108): picture -> cutout -> mesh -> rig -> package, with the retry rule and the route C fallback.

Retry rule (docs/community-characters.md, measured on 8 characters): the mesh step is tried with the first seed, then once with a new seed,
then once at 60 percent picture size. If all three fail, a provider that has a fallback (route C) gives a Rookie in the picture's colours;
a provider with none ends with a plain failure and the caller gives the player's slot back."""
from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Optional

from . import package as pk
from .contracts import (Baked, CharacterMaker, Cutout, NotConfigured, Package, Picture, Progress, Refused, Request, StepFailed, STAGES)

ATTEMPTS = [(0, 1.0), (1, 1.0), (1, 0.6)]  # (seed offset, picture scale): the order of the retry rule


@dataclass
class Result:
    package: Package
    route: str                                  # "A" (lifted) or "C" (fallback)
    provider: str
    attempts: list = field(default_factory=list)
    seconds: dict = field(default_factory=dict)
    cost_usd: float = 0.0
    notes: list = field(default_factory=list)
    stretch: dict = field(default_factory=dict)
    picture_png: bytes = b""                    # kept so a run can save its inputs (the server drops them)
    mask_png: bytes = b""


class Failed(Exception):
    """The pipeline ended without a character. `refund` is True when the player's slot should be given back."""
    def __init__(self, stage: str, why: str, refund: bool = True):
        super().__init__(f"{stage}: {why}")
        self.stage, self.why, self.refund = stage, why, refund


def run(maker: CharacterMaker, req: Request, progress: Optional[Progress] = None, template=None, sleep=time.sleep) -> Result:
    say = progress or (lambda stage, info: None)
    why = maker.configured()
    if why:
        raise Failed("picture", f"not configured: {why}", refund=True)
    res = Result(package=None, route="A", provider=maker.id)  # type: ignore[arg-type]
    t = time.time()
    clock = lambda name: res.seconds.__setitem__(name, round(time.time() - t, 2))  # noqa: E731

    def stage(name, **info):
        say(name, {"index": STAGES.index(name), "total": len(STAGES), **info})

    # 1 picture (a failed picture is tried once more: it is the cheapest step)
    stage("picture")
    pic: Optional[Picture] = None
    for n in range(2):
        try:
            pic = maker.picture(req); break
        except NotConfigured as e:
            raise Failed("picture", f"not configured: {e}")
        except (StepFailed, Refused) as e:
            res.attempts.append({"stage": "picture", "ok": False, "error": str(e)[:200]})
    if pic is None:
        raise Failed("picture", "no picture came back")
    res.cost_usd += pic.cost_usd; clock("picture"); t = time.time()

    # 2 cutout (once more on a failure)
    stage("cutout")
    cut: Optional[Cutout] = None
    for n in range(2):
        try:
            cut = maker.cutout(pic); break
        except NotConfigured as e:
            raise Failed("cutout", f"not configured: {e}")
        except (StepFailed, Refused) as e:
            res.attempts.append({"stage": "cutout", "ok": False, "error": str(e)[:200]})
    if cut is not None:
        res.cost_usd += cut.cost_usd
    clock("cutout"); t = time.time()

    # 3 mesh: the retry rule, then the fallback
    stage("mesh", attempt=1)
    baked: Optional[Baked] = None
    if cut is not None:
        for k, (dseed, scale) in enumerate(ATTEMPTS):
            try:
                baked = maker.mesh(pic, cut, req.seed + dseed, scale)
                res.attempts.append({"stage": "mesh", "ok": True, "seed": req.seed + dseed, "scale": scale})
                res.cost_usd += baked.cost_usd
                break
            except NotConfigured as e:
                res.attempts.append({"stage": "mesh", "ok": False, "error": f"not configured: {e}"}); break
            except (StepFailed, Refused) as e:
                res.attempts.append({"stage": "mesh", "ok": False, "seed": req.seed + dseed, "scale": scale, "error": str(e)[:200]})
                if k + 1 < len(ATTEMPTS):
                    stage("mesh", attempt=k + 2, retry=True)
    if baked is None:
        res.route = "C"
        res.notes.append("The 3D step failed, so this is the Rookie in your picture's colours.")
        baked = maker.fallback(pic, cut)
        if baked is None:
            raise Failed("mesh", "the 3D step failed and this provider has no fallback", refund=True)
    clock("mesh"); t = time.time()

    # 4 rig and 5 package (one call walks the size ladder)
    stage("rig")
    meta = {"prompt": req.prompt, "provider": maker.id, "route": res.route, "seed": req.seed, "owner": req.owner}
    try:
        stage("package")
        pkg, rigged = pk.package(baked, pic.png, cut.mask_png if cut else None, meta, template)
    except Refused as e:
        raise Failed("package", str(e), refund=True)
    res.package, res.stretch = pkg, rigged.stretch
    res.picture_png, res.mask_png = pic.png, (cut.mask_png if cut else b"")
    res.seconds["rig_package"] = round(time.time() - t, 2)
    pkg.meta["cost_usd"] = round(res.cost_usd, 4)
    pkg.meta["notes"] = res.notes
    return res
