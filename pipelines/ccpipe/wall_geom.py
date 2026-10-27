"""The warped wall as geometry, and the simulator's wall run turned into targets for Kimodo (CC-17).

Coordinates are the clip file's: y up, the run goes along +z, the character's left is +x.
The simulator's x (toward the wall) is z here and its y is y; the wall is a quarter circle of radius R = height,
centre (z=0, y=R), flat at the foot and vertical at the top edge (z=R, y=R); the deck is behind the edge at y=R."""
import json

import numpy as np

FPS = 30
TICKS_PER_FRAME = 4              # the simulator runs at 120 Hz
HIP_HEIGHT = 1.0                 # the simulator's hips above the feet while running (DEFAULT_WALL.hipHeight)
HIPS_DROP = 0.02                 # hips aimed this far under the simulator's path so a straight leg can reach the planted foot (inside the 5 cm line)
ANKLE_OFFSET = 0.08              # an ankle sits this far from the sole it stands on
WRIST_OFFSET = (-0.03, -0.02)    # (z, y): the wrist sits just in front of and under the top edge, fingers over the lip
HAND_SPACING = 0.2               # the hands grip this far apart
FOOT_SPACING = 0.09              # each foot is this far from the middle line
CLIP_FRAMES = 90                 # 3.0 s at 30 fps
ENTRY_FRAME = 30                 # the feet reach the foot of the curve 1.0 s into the clip
PLANTS = [("RightFoot", 49, 55), ("LeftFoot", 56, 62)]   # (foot, first frame, last frame) still on the curve
GRIP_REACH = 1.0                 # the grab is the first moment the wrist target is within this of the hips (the arm is 1.07 m at full stretch)
GRIP_LAST = 74                   # the hands stay on the edge until here
DECK_FIRST = 80                  # the feet stand on the deck from here to the end
MAX_ARM = 1.07                   # hips to wrist, arm straight (the Kimodo body, measured on its samples)
LEG = 0.91                       # hips to ankle, leg straight
PLANT_REACH = (0.5, 0.88)        # a planted ankle stays this far (min, max) from the hips for the whole plant, so the knee can always bend


class Wall:
    def __init__(self, height=4.3, radius=None):
        self.h = height
        self.r = radius or height

    def surface_y(self, z):
        """Height of the curve at distance z from the foot (0 <= z <= R); the vertical face above R."""
        z = np.clip(z, 0, self.r)
        return self.r - np.sqrt(np.maximum(self.r ** 2 - z ** 2, 0))

    def sdf(self, p):
        """Signed distance (m) from points (..., [x, y, z]) to the wall: positive in the air, negative inside the solid.
        The solid is under the curve for 0 <= z <= R and the block z > R under the deck; before the foot there is only the floor.
        Near the top edge the distance is that to the corner, so it is never too small by much and never wrongly negative."""
        p = np.asarray(p, float)
        z, y = p[..., 2], p[..., 1]
        r = self.r
        quadrant = np.where(y > self.h, np.hypot(z - r, y - self.h), r - np.hypot(z, y - r))
        block = np.where(y >= self.h, y - self.h, -np.minimum(z - r, self.h - y))
        return np.where(z < 0, y, np.where(z <= r, quadrant, block))

    def normal(self, p):
        """Unit direction of increasing sdf (finite differences in y and z)."""
        e = 1e-4
        p = np.asarray(p, float)
        dz = (self.sdf(p + [0, 0, e]) - self.sdf(p - [0, 0, e])) / (2 * e)
        dy = (self.sdf(p + [0, e, 0]) - self.sdf(p - [0, e, 0])) / (2 * e)
        n = np.stack([np.zeros_like(dz), dy, dz], axis=-1)
        return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)

    def push_out(self, p, margin=0.0):
        """Move points that are closer than `margin` to the wall (or inside it) along the normal until they are `margin` away."""
        p = np.asarray(p, float).copy()
        for _ in range(4):
            d = self.sdf(p)
            bad = d < margin - 1e-6
            if not bad.any():
                break
            p[bad] += self.normal(p)[bad] * (margin - d[bad])[..., None]
        return p

    def curve_point(self, z):
        """Point (x=0, y, z) on the curve and the air-side unit normal there (toward the circle's centre)."""
        z = float(np.clip(z, 0, self.r))
        y = float(self.surface_y(z))
        n = np.array([0.0, self.r - y, -z]) / self.r
        return np.array([0.0, y, z]), n


def _frame_path(path, tick):
    """Simulator feet position (x, y) at a fractional tick, by interpolation."""
    path = np.asarray(path)
    t = min(max(tick, 0), len(path) - 1)
    a = int(np.floor(t))
    b = min(a + 1, len(path) - 1)
    return path[a] + (path[b] - path[a]) * (t - a)


def build_targets(sim, wall=None):
    """Targets for the clip from the exported simulator wall run (scripts/wall-path-export.ts).

    Returns a dict with the feet and hips paths per frame, the plants, the grip and the deck stand.
    The hips path is the simulator's feet path plus its hip height (less HIPS_DROP); before the curve the runner is on level ground."""
    wall = wall or Wall(sim["params"]["height"], sim["params"].get("radius"))
    apex = sim["apexPath"]
    speed = sim["entrySpeed"]
    feet = np.zeros((CLIP_FRAMES, 2))           # (z, y)
    for f in range(CLIP_FRAMES):
        if f < ENTRY_FRAME:
            feet[f] = (-speed * (ENTRY_FRAME - f) / FPS, 0.0)
        else:
            feet[f] = _frame_path(apex, (f - ENTRY_FRAME) * TICKS_PER_FRAME)
    sim_hips = np.stack([np.zeros(CLIP_FRAMES), feet[:, 1] + HIP_HEIGHT, feet[:, 0]], axis=1)   # (x, y, z)
    hips = sim_hips - [0, HIPS_DROP, 0]
    edge = np.array([0.0, wall.h, wall.r])
    wrist = {"LeftHand": edge + [HAND_SPACING / 2, WRIST_OFFSET[1], WRIST_OFFSET[0]],
             "RightHand": edge + [-HAND_SPACING / 2, WRIST_OFFSET[1], WRIST_OFFSET[0]]}
    # the grab: the first frame whose hips are within GRIP_REACH of the wrist target (the simulator's own tick 64 is 2.45 m away)
    mid = (wrist["LeftHand"] + wrist["RightHand"]) / 2
    reach = np.linalg.norm(sim_hips - mid, axis=1)
    grab = int(next(f for f in range(ENTRY_FRAME, CLIP_FRAMES) if reach[f] <= GRIP_REACH))
    plants = []
    for foot, a, b in PLANTS:
        # the lowest point on the curve whose ankle the hips never get farther than a straight leg from (or nearer than a folded one to)
        for z in np.linspace(2.0, wall.r - 0.1, 441):
            p, n = wall.curve_point(z)
            d = np.linalg.norm(hips[a:b + 1] - (p + n * ANKLE_OFFSET + [FOOT_SPACING * (1 if foot == "LeftFoot" else -1), 0, 0]), axis=1)
            if d.min() >= PLANT_REACH[0] and d.max() <= PLANT_REACH[1]:
                break
        else:
            raise ValueError(f"no point on the curve can hold the {foot} for frames {a}-{b}")
        ankle = p + n * ANKLE_OFFSET
        ankle[0] = FOOT_SPACING if foot == "LeftFoot" else -FOOT_SPACING
        plants.append({"joint": foot, "frames": [a, b], "point": ankle.round(4).tolist(), "sole": p.round(4).tolist(),
                       "hips_to_ankle": [round(float(d.min()), 3), round(float(d.max()), 3)]})
    deck_y = wall.h + ANKLE_OFFSET
    deck_z = float(feet[-1, 0])
    deck = [{"joint": "LeftFoot", "frames": [DECK_FIRST, CLIP_FRAMES - 1], "point": [FOOT_SPACING, deck_y, deck_z]},
            {"joint": "RightFoot", "frames": [DECK_FIRST, CLIP_FRAMES - 1], "point": [-FOOT_SPACING, deck_y, deck_z]}]
    grips = [{"joint": j, "frames": [grab, GRIP_LAST], "point": wrist[j].round(4).tolist()} for j in wrist]
    return {
        "fps": FPS, "frames": CLIP_FRAMES, "entry_frame": ENTRY_FRAME, "grab_frame": grab,
        "sim_hips": sim_hips.round(4).tolist(), "hips": hips.round(4).tolist(),
        "edge": edge.tolist(), "plants": plants, "grips": grips, "deck": deck,
        "hips_to_wrist_at_grab": round(float(reach[grab]), 3),
        "hips_to_wrist_at_sim_grab_tick": round(float(reach[min(ENTRY_FRAME + 64 // TICKS_PER_FRAME, CLIP_FRAMES - 1)]), 3),
    }


def load_targets(sim_path):
    with open(sim_path) as f:
        return build_targets(json.load(f))
