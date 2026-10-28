"""What each move asks of Kimodo (CC-54): the text, the length, and the key poses with the frames they are held on. 30 fps."""
import numpy as np

from poses import hang_pose, swing_pose, vault_pose
from ccpipe.skeleton import IDX

FPS = 30


def centred(p, hips_xyz):
    """Pose with its hips moved to hips_xyz in x and z (y stays as authored, it already encodes the bar or box height)."""
    q = p.copy()
    q[:, 0] += hips_xyz[0] - p[IDX["Hips"], 0]
    q[:, 2] += hips_xyz[2] - p[IDX["Hips"], 2]
    return q


def moves(round=1):
    """name -> {text, frames, keys: [(frame, (30,3) positions)], supportedBy}. Round 2 changes two things after round 1 failed the gate:
    a smaller swing (0.3 rad, two key poses) and a tucked vault pose."""
    hang = hang_pose(bar_z=0.3)
    keys_hang = [(f, hang) for f in range(80, 120, 8)]  # held from 2.7 s to the end
    # a pendulum of length 1.4 m has a half period of 1.19 s (36 frames): front, back, front, back
    keys_swing = []
    for f, phi in (((15, 0.5), (51, -0.5), (87, 0.5), (123, -0.5)) if round == 1 else ((15, 0.3), (51, -0.3))):
        keys_swing.append((f, swing_pose(phi, bar_z=0.3)))
    keys_vault = []
    for f in (54, 55, 56):  # the hand is on the box on the middle frame; the body moves on at 4 m/s (0.133 m a frame)
        keys_vault.append((f, centred(vault_pose(tucked=round == 2), (0.0, 0, 5.0 + (f - 55) * 4.0 / FPS))))
    return {
        "hang": {"text": "A person jumps up, grabs an overhead bar with both hands and hangs from it.", "frames": 120, "keys": keys_hang,
                 "supportedBy": ["overhead bar"]},
        "swing": {"text": "A person hangs from a high bar with both hands and swings their body back and forth like a pendulum.", "frames": 150,
                  "keys": keys_swing, "supportedBy": ["overhead bar"]},
        "vault": {"text": "A person sprints toward a low box, plants one hand on top and vaults over it sideways, then lands and keeps running.",
                  "frames": 120, "keys": keys_vault, "supportedBy": ["a low box"]},
    }
