"""Tripo, the slot kept open (CC-108). It returns 'not configured' until someone adds credits and a key and fills in the three methods.
Tripo's text-or-image-to-model call would replace `picture` + `cutout` + `mesh` in one go (about 110 credits a character, about $1.10): to fill the slot,
return a Baked (upright mesh, uv, texture) from `mesh`, and the shared rig and package steps do the rest. No credits are bought by this repo."""
import os
from ..contracts import CharacterMaker, NotConfigured


class TripoMaker(CharacterMaker):
    id = "tripo"
    label = "Tripo (not configured)"

    def configured(self):
        return "no Tripo key or credits set here" if not os.environ.get("TRIPO_API_KEY") else "the Tripo call is not written yet"
