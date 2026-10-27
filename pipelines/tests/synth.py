"""Synthetic clips for testing the gate: a stick body whose knees and flight we control exactly."""
import numpy as np

from ccpipe.clip import Clip
from ccpipe.skeleton import IDX, N_JOINTS

THIGH = SHIN = 0.45


def body(hip, bend_l=10.0, bend_r=10.0, backwards=False, twist_l=0.0):
    """One frame: hips at `hip` (x, y, z), body facing +z, left on +x. Knees bend by `bend_*` degrees."""
    j = np.zeros((N_JOINTS, 3))
    hip = np.asarray(hip, float)
    j[IDX["Hips"]] = hip
    for name, up in (("Spine1", 0.15), ("Spine2", 0.3), ("Chest", 0.45), ("Neck1", 0.55), ("Neck2", 0.62), ("Head", 0.7)):
        j[IDX[name]] = hip + [0, up, 0]
    for name in ("Jaw", "LeftEye", "RightEye"):
        j[IDX[name]] = hip + [0, 0.75, 0.08]
    for s, sx in (("Left", 1), ("Right", -1)):
        j[IDX[f"{s}Shoulder"]] = hip + [0.1 * sx, 0.5, 0]
        j[IDX[f"{s}Arm"]] = hip + [0.2 * sx, 0.5, 0]
        j[IDX[f"{s}ForeArm"]] = hip + [0.22 * sx, 0.2, 0]
        j[IDX[f"{s}Hand"]] = hip + [0.22 * sx, -0.05, 0]
        j[IDX[f"{s}HandThumbEnd"]] = hip + [0.22 * sx, -0.15, 0.03]
        j[IDX[f"{s}HandMiddleEnd"]] = hip + [0.22 * sx, -0.2, 0]
    for s, sx, bend in (("Left", 1, bend_l), ("Right", -1, bend_r)):
        a = np.radians(bend) / 2 * (-1 if backwards else 1)
        h = hip + [0.1 * sx, 0, 0]
        k = h + THIGH * np.array([0, -np.cos(a), np.sin(a)])
        if s == "Left" and twist_l:  # turn the left knee out sideways by rotating the leg's plane about the vertical
            t = np.radians(twist_l)
            d = k - h
            k = h + [d[0] * np.cos(t) + d[2] * np.sin(t), d[1], -d[0] * np.sin(t) + d[2] * np.cos(t)]
        d = np.array([0, -np.cos(-a), np.sin(-a)])
        if s == "Left" and twist_l:
            d = np.array([d[0] * np.cos(t) + d[2] * np.sin(t), d[1], -d[0] * np.sin(t) + d[2] * np.cos(t)])
        an = k + SHIN * d
        j[IDX[f"{s}Leg"]], j[IDX[f"{s}Shin"]], j[IDX[f"{s}Foot"]] = h, k, an
        j[IDX[f"{s}ToeBase"]] = an + [0, -0.02, 0.15]
    return j


def standing(n=30, fps=30.0, speed=0.0, **kw):
    """Stand (or walk forward at `speed`), feet on the floor (ankle at 8 cm, toes at floor level)."""
    f = []
    for i in range(n):
        j = body((0, 0.9, speed * i / fps), **kw)
        j[:, 1] -= j[:, 1].min()
        f.append(j)
    return Clip(np.array(f), fps)


def jump(g=9.81, flight_frames=18, fps=30.0, speed=4.0, lead=6, tail=6):
    """Stand, take off, fly for `flight_frames` under gravity `g`, land, stand. Hips move forward at `speed`."""
    T = flight_frames / fps
    v0 = g * T / 2
    f = []
    n = lead + flight_frames + 1 + tail
    for i in range(n):
        k = i - lead
        lift = 0.0 if k <= 0 or k >= flight_frames else v0 * (k / fps) - 0.5 * g * (k / fps) ** 2
        j = body((0, 0.9, speed * i / fps))
        j[:, 1] -= j[:, 1].min()
        j[:, 1] += lift
        f.append(j)
    return Clip(np.array(f), fps)
