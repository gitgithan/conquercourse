"""Shared helpers for the PartLLM scorers: load a GLB as one mesh and turn an answer-key hold into a face mask."""
import pathlib

import numpy as np
import trimesh

OBJ = pathlib.Path("public/assets/objects")


def load(name):
    sc = trimesh.load(OBJ / f"{name}.glb")
    return trimesh.util.concatenate(sc.dump())


def hold_mask(m, hold):
    c = m.triangles_center
    if "box" in hold or "boxes" in hold:
        mask = np.zeros(len(c), bool)
        for b in [hold["box"]] if "box" in hold else hold["boxes"]:
            mask |= np.all((c >= b[:3]) & (c <= b[3:]), axis=1)
        return mask
    s, d = hold["slice_m"], hold["depth_m"]
    idx = np.floor((c[:, 0] - c[:, 0].min()) / s).astype(int)
    mask = np.zeros(len(c), bool)
    for i in np.unique(idx):
        sel = idx == i
        mask[sel] = c[sel, 1] >= c[sel, 1].max() - d
    return mask
