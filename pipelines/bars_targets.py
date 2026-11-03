"""Targets for Kimodo on the monkey bars (CC-133): hips path and hand grips on overhead rungs.

    python pipelines/bars_targets.py data/eval/bar-motion/inputs

Writes travel.json, idle.json and kip.json in the format pipelines/kimodo_wall.py reads
({"frames", "hips": [T][x,y,z], "plants": [], "grips": [{"joint", "frames": [a, b], "point"}], "deck": []}).
Axes as in the clips: run along +z, left on +x, y up, metres, 30 fps. Earth gravity only; no formula is shown to a player."""
import json
import math
import os
import sys

FPS = 30
RUNG_Y = 2.2          # wrist height on the rung
HIPS_Y = 1.2          # hips hang this far under the rung (arms nearly straight, feet clear of the floor)
HAND_X = 0.18         # each hand this far from the centre line
RUNG_GAP = 0.4        # distance between rungs, along the travel
MOVE_S = 0.3          # a reach takes this long
CYCLE_S = 1.2         # one hand moves once per cycle, two rungs forward; the other hand half a cycle later
SPEED = 2 * RUNG_GAP / CYCLE_S   # the body keeps pace with the hands: 0.67 m/s
LEAD = 0.3            # a hand is this far ahead of the hips when it grips


def _frames(a, b):
    return [int(round(a * FPS)), int(round(b * FPS)) - 1]


def travel(seconds=5.0):
    T = int(seconds * FPS)
    hips = [[0.0, HIPS_Y, SPEED * i / FPS] for i in range(T)]
    grips = []
    for joint, x, phase in (("LeftHand", HAND_X, 0.0), ("RightHand", -HAND_X, CYCLE_S / 2)):
        t = phase - CYCLE_S                      # the first hold may have started before the clip
        while t < seconds:
            hold0, hold1 = t, t + CYCLE_S - MOVE_S
            z = SPEED * hold0 + LEAD
            a, b = max(hold0, 0.0), min(hold1, seconds)
            if b - a > 2 / FPS:
                grips.append({"joint": joint, "frames": _frames(a, b), "point": [x, RUNG_Y, round(z, 4)]})
            t += CYCLE_S
    return {"frames": T, "hips": hips, "plants": [], "grips": grips, "deck": [], "kind": "travel"}


def idle(seconds=3.0):
    T = int(seconds * FPS)
    hips = [[0.0, HIPS_Y, 0.0] for _ in range(T)]
    grips = [{"joint": j, "frames": _frames(0, seconds), "point": [x, RUNG_Y, 0.2]}
             for j, x in (("LeftHand", HAND_X), ("RightHand", -HAND_X))]
    return {"frames": T, "hips": hips, "plants": [], "grips": grips, "deck": [], "kind": "idle"}


def kip(seconds=4.5, period=1.5, amp_end=0.55):
    """Hands fixed, hips swing like a pendulum under the rung, each swing a little bigger (a kip pumps the swing)."""
    T = int(seconds * FPS)
    arm = RUNG_Y - HIPS_Y
    hips = []
    for i in range(T):
        t = i / FPS
        amp = 0.15 + (amp_end - 0.15) * min(t / (seconds * 0.8), 1.0)
        dz = amp * math.sin(2 * math.pi * t / period)
        hips.append([0.0, round(RUNG_Y - math.sqrt(arm ** 2 - dz ** 2), 4), round(dz, 4)])
    grips = [{"joint": j, "frames": _frames(0, seconds), "point": [x, RUNG_Y, 0.2]}
             for j, x in (("LeftHand", HAND_X), ("RightHand", -HAND_X))]
    return {"frames": T, "hips": hips, "plants": [], "grips": grips, "deck": [], "kind": "kip"}


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, fn in (("travel", travel), ("idle", idle), ("kip", kip)):
        with open(os.path.join(out, f"{name}.json"), "w") as f:
            json.dump(fn(), f, indent=2)
            f.write("\n")
        print(name, "written")
