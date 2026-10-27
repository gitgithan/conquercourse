# CC-31: the Rookie as an actor the Course can drive

- **What it shows:** the real Rookie, posed from the shipped clips, follows the simulator's state on the whole default course (`?demo=actor`).
- **Commands:**
  - `npm run dev`, then open `http://localhost:5173/?demo=actor` (`&rookie=b`, `&t0=<tick>` starts later).
  - `node scripts/actor-check.mjs a` saves contact sheets of the gap, wall, rope and trampoline to `test-results/`.
  - `node scripts/actor-gate.mjs a`, then `uv run --no-project --with numpy python -I pipelines/gate_posed.py data/eval/cc-31-actor/posed-run-a.json data/eval/cc-31-actor/posed-leap-a.json` (and `-b`).
  - `scripts/film-actor.sh a` films the first gap and the wall at true speed.
- **Inputs:** `public/assets/motion/{run,leap,land,swing,reach}.json`, `public/assets/characters/rookie-{a,b}.glb`, the simulator, `src/course/default-course.json` and its ideal plan.
- **Outputs:** `posed-*.json` (posed joints at 30 fps) and `gate-*.json` (the gate's report).

## How each state is dressed
- **Standing:** the first frame of the reach clip (feet together, arms low), because the first run frame is mid-stride.
- **Running:** the run clip, looked up by distance run (feet stay planted at any speed); under 0.9 m/s it blends to the stand pose.
- **Take-off and flight:** the leap clip from take-off to touch-down, timed by vertical speed (a symmetric arc); the body follows the centre of mass, and in the last 20 % of the flight the feet take over so they meet the surface.
- **Landing:** the land clip from its touch-down frame for 0.5 s; the crouch is 22 % deeper when `squat` is true (a quarter of that when not).
- **Rope:** the swing clip with the hands moved onto the grip (2.1 m above the feet), arms straight, trunk and legs straightened (the clip is a swing seat, folded); the whole body turns about the grip by the rope angle.
- **Bounce:** the leap clip's take-off pose, 8 % taller.
- **Wall (composed, there is no wall clip):**
  - run clip while on the curve; the body leans into the slope by up to 26° (at 45°) and is upright again on the vertical part, so the head never goes into the wall;
  - the reach clip over the last 25 % of `wallProgress`;
  - the hand-over onto the deck is only the simulator moving the feet while the reach clip settles into a stand.

## What is missing (the owner decides)
- **Wall climb:** the run clip is not a wall run, and the feet are not placed on the curve.
  - Option 1: Kimodo with the simulator's wall path as targets (CC-17).
  - Option 2: measured video motion (CC-29 failed the gate on the wall clip, so only as Kimodo targets).
- **Mantle (pull-up over the edge):** no clip at all; the reach clip stands in.
- **Rope catch and release:** the catch is a 12-tick blend from the leap pose to the hanging pose, and the release is a blend back; a reach-to-grab and a let-go clip would remove the blend.
- **Rope hang:** the swing clip is a seat, so the legs are procedural (straight, knees forward); a real hang-and-swing clip would add the leg pump.
- **Trampoline:** one stretched pose on the bed; a squash, a push-off and a tucked or open flight clip would be better.
- **Stand and turn:** no idle clip; the Rookie never turns around (facing -1 turns the whole body).
