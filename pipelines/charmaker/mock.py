"""Mock providers for the tests and the offline demo (CC-108): no network, no GPU. The "lift" returns the Rookie's own mesh in another colour, so the rig and the size checks run on real geometry."""
from __future__ import annotations
import io
import numpy as np
from PIL import Image, ImageDraw

from . import route_c
from .contracts import Baked, CharacterMaker, Cutout, Picture, Refused, StepFailed


def fake_picture(colour=(220, 90, 40)) -> bytes:
    im = Image.new("RGB", (256, 384), (170, 210, 235))
    d = ImageDraw.Draw(im)
    d.ellipse((108, 40, 148, 80), fill=colour); d.rectangle((118, 80, 138, 200), fill=colour)
    d.rectangle((40, 100, 216, 116), fill=colour); d.rectangle((108, 200, 124, 330), fill=colour); d.rectangle((132, 200, 148, 330), fill=colour)
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


def fake_mask() -> bytes:
    im = Image.new("L", (256, 384), 0); d = ImageDraw.Draw(im)
    d.ellipse((108, 40, 148, 80), fill=255); d.rectangle((118, 80, 138, 200), fill=255)
    d.rectangle((40, 100, 216, 116), fill=255); d.rectangle((108, 200, 124, 330), fill=255); d.rectangle((132, 200, 148, 330), fill=255)
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


class MockMaker(CharacterMaker):
    """`mesh_fails`: how many mesh calls raise StepFailed before one works (3 or more: the lift is down)."""
    id = "mock"
    label = "mock"

    def __init__(self, mesh_fails=0, picture_fails=0, has_fallback=True, ready=None):
        self.mesh_fails, self.picture_fails, self.has_fallback, self.ready = mesh_fails, picture_fails, has_fallback, ready
        self.calls = []

    def configured(self):
        return self.ready

    def picture(self, req):
        self.calls.append(("picture", req.seed))
        if self.picture_fails > 0:
            self.picture_fails -= 1; raise StepFailed("mock picture down")
        return Picture(png=fake_picture(), cost_usd=0.01)

    def cutout(self, pic):
        self.calls.append(("cutout",))
        return Cutout(mask_png=fake_mask(), score=0.9, cost_usd=0.0025)

    def mesh(self, pic, cut, seed, scale):
        self.calls.append(("mesh", seed, scale))
        if self.mesh_fails > 0:
            self.mesh_fails -= 1; raise StepFailed("mock lift dropped the connection")
        b = route_c.rookie_in_your_colours(pic.png, cut.mask_png)
        b.cost_usd = 0.03
        return b

    def fallback(self, pic, cut):
        self.calls.append(("fallback",))
        return route_c.rookie_in_your_colours(pic.png, cut.mask_png if cut else None) if self.has_fallback else None
