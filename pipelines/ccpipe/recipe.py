"""Move recipes: a measured move written so it can be reused on other obstacles.

A recipe says what the body did around one obstacle: phases (run-up, plant, grip, hang, release, landing), contact events with the
primitive type and the position as a fraction of the obstacle's height, timing and speeds, and where else the move could go.
Every field is tagged measured, estimated or guess in `provenance`, and a recipe from a clip that failed the gate says so."""
import numpy as np

from . import motion
from .skeleton import FEET, IDX

RECIPE_VERSION = "0.1.0"
REACH_SLACK_M = 0.2             # a grip a little above the measured highest hand still counts as reachable
RETARGET_RANGE = (0.7, 1.3)     # heights scale by the obstacle ratio only inside this range (a guess, to be tuned)

# where a move could go, by the primitive it was measured on: a guess, never a measurement
TRANSFER_GUESSES = {
    "ramp": [("wall", "run at it, plant a foot low, reach the top edge: the curve is replaced by a flat face, so the plant is lower and the speed matters less"),
             ("platform", "as a climb onto a high deck: plant, grab the edge, pull up"),
             ("ramp", "same move on a ramp of another height or radius: scale contact heights by the height ratio")],
    "wall": [("ramp", "swap the flat face for a curve: the plant moves higher and the run-up speed becomes the lesson"),
             ("platform", "as a climb onto a high deck: grab the edge, pull up"),
             ("wall", "a wall of another height: scale contact heights by the height ratio")],
    "platform": [("wall", "a step-up becomes a vault or climb when the top is higher than the hips"),
                 ("platform", "another deck height: scale the take-off and landing heights")],
    "bar": [("ropeAnchor", "a grip with the feet off the ground becomes a swing when the hold can move"),
            ("bar", "another bar height: the grip must stay within the measured reach")],
    "ropeAnchor": [("bar", "a swing becomes a hang when the hold is fixed")],
}


def _hold(frames, fps):
    """Per-frame True where the feet are off the floor (more than 15 cm)."""
    return frames[:, FEET, 1].min(axis=1) > 0.15


def athlete_numbers(frames, fps):
    head = frames[:, IDX["Head"], 1]
    hands = frames[:, [IDX["LeftHand"], IDX["RightHand"]], 1]
    return {"standing_height_m": round(float(np.percentile(head, 90)), 3), "highest_hand_m": round(float(hands.max()), 3),
            "highest_hip_m": round(float(frames[:, IDX["Hips"], 1].max()), 3)}


def hip_speed_xz(frames, fps):
    v = np.gradient(frames[:, IDX["Hips"], [0, 2]], axis=0) * fps
    k = np.ones(5) / 5
    return np.convolve(np.linalg.norm(v, axis=1), k, mode="same")


def _top_of(prim):
    if not prim:
        return None
    s = prim["sizes"]
    return s.get("height", s.get("anchorHeight", s.get("restHeight")))


def detect_phases(frames, times, contacts):
    """Phases from the order of contacts. Each is {name, frames [a, b), t [t0, t1], measured: True}; a missing phase is simply absent."""
    t = np.asarray(times, float)
    n = len(frames)
    obs = [c for c in contacts if c["kind"] == "obstacle"]
    ground = [c for c in contacts if c["kind"] == "ground"]
    foot_obs = [c for c in obs if c["joint"].endswith("Foot")]
    hand_obs = [c for c in obs if c["joint"].endswith("Hand")]
    marks = []

    def add(name, a, b):
        a, b = int(max(a, 0)), int(min(b, n - 1))
        if b >= a:
            marks.append({"name": name, "frames": [a, b + 1], "t": [round(float(t[a]), 3), round(float(t[b]), 3)], "measured": True})

    first = min((c["frames"][0] for c in obs), default=None)
    if first is None:
        return marks
    if first > 1:
        add("run-up", 0, first - 1)
    if foot_obs:
        p = min(foot_obs, key=lambda c: c["frames"][0])
        add("plant", p["frames"][0], p["frames"][1])
    grips = [c for c in hand_obs if not foot_obs or c["frames"][0] >= min(f["frames"][0] for f in foot_obs) - 2]
    if grips:
        g = min(grips, key=lambda c: c["frames"][0])
        add("grip", g["frames"][0], g["frames"][1])
        last_hand = max(c["frames"][1] for c in hand_obs)
        if last_hand > g["frames"][1] + 2:
            add("hang-or-pull", g["frames"][1], last_hand)
        add("release", last_hand, min(last_hand + 2, n - 1))
    last_obs = max(c["frames"][1] for c in obs)
    land = [c for c in ground if c["frames"][0] >= last_obs]
    if land:
        add("landing", min(c["frames"][0] for c in land), min(c["frames"][1] for c in land))
    return sorted(marks, key=lambda m: m["frames"][0])


def phase_of(i, phases):
    for p in phases:
        if p["frames"][0] <= i < p["frames"][1]:
            return p["name"]
    return None


def contact_events(frames, times, contacts, phases, prim, floor_m=0.0):
    """Contact events in time order with the primitive type and height as a fraction of the obstacle height (None without a height)."""
    top = _top_of(prim)
    plants = [c for c in contacts if c["kind"] == "obstacle" and c["joint"].endswith("Foot")]
    z0 = min(plants, key=lambda c: c["frames"][0])["point"][2] if plants else None
    out = []
    for c in sorted(contacts, key=lambda c: c["frames"][0]):
        y = c["point"][1] - floor_m
        out.append({"joint": c["joint"], "t": [round(c["t"][0], 3), round(c["t"][1], 3)], "hold_s": round(c["t"][1] - c["t"][0], 3),
                    "phase": phase_of(c["frames"][0], phases), "on": prim["type"] if (prim and c["kind"] == "obstacle") else "ground",
                    "height_m": round(y, 3), "height_frac": None if (top is None or c["kind"] != "obstacle") else round(y / top, 3),
                    "metres_past_first_plant": None if z0 is None else round(c["point"][2] - z0, 3),
                    "brief_plant": bool(c.get("brief_plant", False)), "measured": True})
    return out


def timing(frames, times, phases, fps):
    sp = hip_speed_xz(frames, fps)
    by = {p["name"]: p for p in phases}
    out = {"duration_s": round(float(times[-1] - times[0]), 3), "peak_hip_speed_mps": round(float(sp.max()), 2)}
    if "run-up" in by:
        a, b = by["run-up"]["frames"]
        out["approach_speed_mps"] = round(float(np.median(sp[a:b])), 2)
        out["run_up_s"] = round(by["run-up"]["t"][1] - by["run-up"]["t"][0], 3)
    if "plant" in by:
        out["speed_at_plant_mps"] = round(float(sp[by["plant"]["frames"][0]]), 2)
        if "grip" in by:
            out["plant_to_grip_s"] = round(by["grip"]["t"][0] - by["plant"]["t"][0], 3)
    if "grip" in by:
        end = max(p["t"][1] for p in phases if p["name"] in ("grip", "hang-or-pull"))
        out["held_by_hands_s"] = round(end - by["grip"]["t"][0], 3)
    fl = motion.longest_flight(motion.supported(frames, fps))
    out["longest_flight_s"] = 0.0 if fl is None else round((fl[1] - fl[0]) / fps, 3)
    return out


def classify(phases, athlete, contacts):
    """A plain name for the move from what touched what (a guess from rules, not a model)."""
    names = {p["name"] for p in phases}
    plant_h = max((c["point"][1] for c in contacts if c["kind"] == "obstacle" and c["joint"].endswith("Foot")), default=0.0)
    if {"plant", "grip"} <= names and plant_h >= 0.4:
        return "wall-run-and-grab"
    if "grip" in names and "hang-or-pull" in names:
        return "grab-and-hang"
    if "grip" in names:
        return "grab"
    if "plant" in names:
        return "plant-and-push"
    return "unclassified"


def build_recipe(frames, times, contacts, prim, source, gate, scale_note=""):
    """frames (T,30,3) metres y up (gated), times seconds, contacts from post.contacts, prim from primitives.fit or None."""
    frames, times = np.asarray(frames, float), np.asarray(times, float)
    fps = (len(times) - 1) / (times[-1] - times[0])
    phases = detect_phases(frames, times, contacts)
    ath = athlete_numbers(frames, fps)
    top = _top_of(prim)
    r = {"recipeVersion": RECIPE_VERSION, "source": source, "move": classify(phases, ath, contacts),
         "gate": {"verdict": "PASS" if gate["pass"] else "FAIL", "failed_rules": [k for k, v in gate["hard"].items() if not v["ok"]]},
         "athlete": ath,
         "obstacle": None if prim is None else {"id": prim["id"], "type": prim["type"], "roles": prim["roles"], "sizes": prim["sizes"],
                                                "height_m": top, "scale": prim.get("scale"), "sizeUncertainty": prim.get("sizeUncertainty")},
         "phases": phases, "contactEvents": contact_events(frames, times, contacts, phases, prim),
         "timing": timing(frames, times, phases, fps),
         "reach": {"highest_hand_m": ath["highest_hand_m"], "grip_height_frac": None if not top else round(ath["highest_hand_m"] / top, 3)}}
    r["transfer"] = [{"to": to, "how": how, "confidence": "guess"} for to, how in TRANSFER_GUESSES.get(prim["type"] if prim else "", [])]
    r["provenance"] = {
        "phases": "measured (from contacts of the gated 30-joint motion)", "contactEvents": "measured times; heights measured in metres with the body model's weak vertical scale",
        "timing": "measured on the clip's own clock", "athlete": "measured", "reach": "measured",
        "obstacle.sizes": "estimated: " + (scale_note or (prim["scale"]["source"] if prim and prim.get("scale") else "no obstacle fitted")),
        "transfer": "guess: rules by obstacle type, not tested in the simulator"}
    r["warnings"] = ([] if gate["pass"] else ["the clip failed the plausibility gate: use the recipe's shape, not its numbers, and never show the motion"])
    return r


def fit_to(recipe, prim):
    """Can this recipe be retargeted to a known obstacle? Returns {ok, height_scale, reasons}. Heights scale by the obstacle ratio; reach must cover the new top."""
    reasons = []
    src = (recipe.get("obstacle") or {}).get("height_m")
    dst = _top_of(prim)
    if src is None or dst is None:
        return {"ok": False, "height_scale": None, "reasons": ["source or target obstacle has no height"]}
    allowed = {t["to"] for t in recipe["transfer"]}
    if prim["type"] not in allowed:
        reasons.append(f"no transfer guess from {recipe['obstacle']['type']} to {prim['type']}")
    ratio = dst / src
    if not RETARGET_RANGE[0] <= ratio <= RETARGET_RANGE[1]:
        reasons.append(f"height ratio {ratio:.2f} is outside {RETARGET_RANGE}: needs a new clip, not a scaled one")
    reach = recipe["reach"]["highest_hand_m"]
    if "grab" in prim["roles"] and dst > (reach * ratio if ratio < 1 else reach) + REACH_SLACK_M and ratio > 1:
        reasons.append(f"the athlete's highest measured hand ({reach:.2f} m) does not cover a top at {dst:.2f} m")
    if recipe["gate"]["verdict"] != "PASS":
        reasons.append("the source clip failed the gate")
    return {"ok": not reasons, "height_scale": round(ratio, 3), "reasons": reasons}
