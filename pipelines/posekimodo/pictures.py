"""Draw each key pose as a plain mannequin picture (front and side), find the body with MediaPipe Pose, and lift the 33 landmarks
back to the 30 SOMA joints (CC-54). Run: /path/to/venv/bin/python pictures.py <mediapipe pose_landmarker .task> <out dir>"""
import json
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from poses import all_poses  # noqa: E402
from ccpipe.skeleton import BONES, IDX, NAMES  # noqa: E402

SKIN, SHIRT, PANTS = (150, 190, 235), (60, 60, 200), (90, 60, 40)  # BGR
SIZE = 640


def draw(p, view):
    """Orthographic picture: 'front' looks at the body from +z (its left is on the image right), 'side' from the body's left (+x, the head up, forward to the left of the image)."""
    u = -p[:, 0] if view == "front" else -p[:, 2]
    v = p[:, 1]
    lo_u, hi_u, lo_v, hi_v = u.min(), u.max(), v.min(), v.max()
    scale = 0.72 * SIZE / max(hi_v - lo_v, (hi_u - lo_u) * 1.2, 1e-6)
    cu, cv_ = (lo_u + hi_u) / 2, (lo_v + hi_v) / 2
    pt = lambda j: (int(SIZE / 2 + (u[j] - cu) * scale), int(SIZE / 2 - (v[j] - cv_) * scale))
    img = np.full((SIZE, SIZE, 3), 235, np.uint8)
    thick = lambda w: max(2, int(w * scale))
    groups = [("Hips", "Spine1", PANTS, 0.2), ("Spine1", "Spine2", SHIRT, 0.24), ("Spine2", "Chest", SHIRT, 0.26), ("Chest", "Neck1", SKIN, 0.09),
              ("Neck1", "Neck2", SKIN, 0.09), ("Neck2", "Head", SKIN, 0.1)]
    for S in ("Left", "Right"):
        groups += [(f"{S}Arm", f"{S}ForeArm", SHIRT, 0.1), (f"{S}ForeArm", f"{S}Hand", SKIN, 0.08), (f"{S}Hand", f"{S}HandMiddleEnd", SKIN, 0.07),
                   (f"{S}Leg", f"{S}Shin", PANTS, 0.15), (f"{S}Shin", f"{S}Foot", PANTS, 0.11), (f"{S}Foot", f"{S}ToeBase", (40, 40, 40), 0.08),
                   (f"{S}Shoulder", f"{S}Arm", SHIRT, 0.1)]
    groups += [("LeftShoulder", "RightShoulder", SHIRT, 0.12), ("LeftLeg", "RightLeg", PANTS, 0.16)]
    for a, b, col, w in groups:
        cv2.line(img, pt(IDX[a]), pt(IDX[b]), col, thick(w), cv2.LINE_AA)
    cv2.circle(img, pt(IDX["Head"]), thick(0.2) // 2 + 6, SKIN, -1, cv2.LINE_AA)
    return img, (u, v, cu, cv_, scale)


# MediaPipe landmark index -> SOMA joint name
MP = {11: "LeftArm", 12: "RightArm", 13: "LeftForeArm", 14: "RightForeArm", 15: "LeftHand", 16: "RightHand", 23: "LeftLeg", 24: "RightLeg",
      25: "LeftShin", 26: "RightShin", 27: "LeftFoot", 28: "RightFoot", 31: "LeftToeBase", 32: "RightToeBase", 0: "Head"}


def landmarks(model_path, img):
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model_path), num_poses=1)
    with vision.PoseLandmarker.create_from_options(opts) as lm:
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not res.pose_landmarks:
        return None
    return [(l.x * SIZE, l.y * SIZE, l.visibility) for l in res.pose_landmarks[0]]


def lift(front, side, truth):
    """Front gives x and y, side gives z and y; scaled so the hips-to-ankles length matches the authored body. Returns {joint: xyz} for the MP joints."""
    out = {}
    for k, name in MP.items():
        fx, fy, _ = front[k]
        sx, sy, _ = side[k]
        out[name] = [-(fx - SIZE / 2), -(fy - SIZE / 2) / 1.0 - (sy - SIZE / 2) / 1.0, -(sx - SIZE / 2)]
        out[name][1] = -((fy + sy) / 2 - SIZE / 2)
    return out


def main(model_path, out):
    os.makedirs(out, exist_ok=True)
    report = {}
    for name, p in all_poses().items():
        imgs, info, found = {}, {}, {}
        for view in ("front", "side"):
            imgs[view], info[view] = draw(p, view)
            cv2.imwrite(os.path.join(out, f"{name}_{view}.png"), imgs[view])
            found[view] = landmarks(model_path, imgs[view])
        entry = {"found_front": found["front"] is not None, "found_side": found["side"] is not None}
        if found["front"] and found["side"]:
            # error in metres: each landmark back to the pose's own scale, against the authored joint it should match
            errs = {}
            for view, axis in (("front", 0), ("side", 2)):
                u, v, cu, cv_, scale = info[view]
                for k, jname in MP.items():
                    px, py, vis = found[view][k]
                    um = (px - SIZE / 2) / scale + cu
                    vm = -(py - SIZE / 2) / scale + cv_
                    truth_u = u[IDX[jname]]
                    truth_v = v[IDX[jname]]
                    errs.setdefault(jname, []).append(float(np.hypot(um - truth_u, vm - truth_v)))
            entry["landmark_error_m"] = {j: round(float(np.mean(e)), 3) for j, e in errs.items()}
            entry["mean_error_m"] = round(float(np.mean([np.mean(e) for e in errs.values()])), 3)
            # the recovered pose: x from the front picture, z from the side picture, y from their mean
            rec = {}
            for k, jname in MP.items():
                uf, vf, cuf, cvf, sf = info["front"]
                us, vs, cus, cvs, ss = info["side"]
                x = -((found["front"][k][0] - SIZE / 2) / sf + cuf)
                z = -((found["side"][k][0] - SIZE / 2) / ss + cus)
                yf = -(found["front"][k][1] - SIZE / 2) / sf + cvf
                ys = -(found["side"][k][1] - SIZE / 2) / ss + cvs
                rec[jname] = [round(float(x), 4), round(float((yf + ys) / 2), 4), round(float(z), 4)]
            entry["recovered"] = rec
        report[name] = entry
    with open(os.path.join(out, "mediapipe.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk in ("found_front", "found_side", "mean_error_m")} for k, v in report.items()}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
