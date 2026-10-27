# CC-16: Rookie A and B posed from the shipped clips

- **What it shows:** both Rookies run, leap, land and run on along the simulator's path; the posed bones go through the same plausibility gate as the source clips.
- **Command:** `node scripts/rookie-check.mjs`, then `uv run --no-project --with numpy python -I pipelines/gate_posed.py data/eval/cc-16-rookies/posed-a.json data/eval/cc-16-rookies/posed-b.json`.
- **Inputs:** `public/assets/motion/{run,leap,land}.json`, `public/assets/characters/rookie-{a,b}.glb`, the simulator in `src/sim/` (jump speed 3 m/s, top speed 4 m/s, jump at tick 420).
- **Outputs:**
  - `errors.json`: worst bone aim error in degrees, and how far the hips sit from the path.
  - `gate-a.json` and `gate-b.json`: the gate's report on each posed lap (30 fps, from the real bone positions in the browser).
  - `posed-{a,b}.json`: the posed joint positions (not committed; kept in `../conquercourse-assets/evidence/`).

## Result
- **Hard rules:** both Rookies pass all six, including "flight is ballistic" (0.2 % and 0.6 % off 9.81 m/s²).
- **Soft rules:** both fail two.
  - Feet slide 3-4.5 cm (limit 3 cm): the Rookies' legs are not the clip's legs, so a planted foot drifts a little.
  - Jerk 300-480 m/s² (limit 200): one spike at take-off, where the simulator's jump changes speed in a single tick.
- **Hips and path:** the hips sit exactly on the path, except where a bent leg would push a foot through the floor; there the hips are lifted by at most 7.9 cm (Rookie A) and 4.0 cm (Rookie B), in the first frames after landing.

## What it took
- The first run failed three rules (ballistic flight 16 % off, jitter 745, feet sliding 5-6 cm).
  - Flight: the arm and leg swing moves the centre of mass inside the body, so the arc is now set on the centre of mass, not the hips.
  - Loop pop: the run clip is not an exact cycle, so the last six frames ease into the first.
  - Sliding: the run pose is now looked up by distance run (feet planted), not by an average stride.
