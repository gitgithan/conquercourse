# Do the same keys give the same result on every machine? (CC-133)

## So what
- The claim "same keys, same result; the server proves a clear by replaying it" is true for outcomes.
  - Tick count, cleared/fell and where the runner ends (6 decimals) were identical in 7,525 runs (all shipped courses, the ideal plan and 300 key-mash seeds each) on Node 22 (V8 12.4) and Node 24 (V8 13.6).
  - The same 1,806 runs on the six affected courses also matched in `workerd` (Cloudflare's runtime, run locally with `wrangler dev`).
- It is not true bit for bit.
  - `x ** 3` and `Math.pow(x, 1.5)` round one step differently in V8 12.4 and V8 13.6 (the 16th digit).
  - Six courses use them: plank, plank-two (beam bending), drone (rotor power), and lache, lache-wide, training (cart rails or vault curve in their ideal runs).
  - After a plank walk the difference grows to about 1e-13 in speed, still far from flipping a result in our runs.
- The CPU is not the cause.
  - The failure on the Vultr VM (Node 22) reproduces on the laptop with Node 22; Node's `Math.pow` is software, not an instruction.
  - The VM was shut down by the owner, so we could not run on it; the Node 22 run here is the same failing set (drone, plank, plank-two, training, lache, lache-wide).
- What we did: `tests/sim-trace.test.ts` now checks tick count and outcome everywhere, and the hash only on V8 13.x.
- Decision for the owner (not made here): make the sim bit-exact on every V8.
  - The smallest fix is `pow-fix.patch`: `x ** 3` becomes `x * x * x` and `Math.pow(T, 1.5)` becomes `T * Math.sqrt(T)` (multiplication and sqrt are exactly rounded, so they cannot differ).
  - With it, Node 22 and Node 24 give identical states at every tick of all 75 mash runs.
  - It changes the stored golden hashes of those six courses (not the course hashes, which hash the course data), so it needs `UPDATE_GOLDEN` and a note in the pull request.
  - Risk: a real clear that lands on a razor-thin margin could move by a tick; check the recorded runs and plans after regenerating.

## What we ran
- `dump.ts` writes the world after every tick; `firstdiff.mjs` finds the first tick and field that differ.
  - Node 22 vs 24: first difference at tick 292 (drone, field `drone.power`, 1 unit in the last place) and tick 628 (plank, `runner.y`, then `runner.vy` 3e-13).
- `mathprobe.mjs` hashes 200,000 results per Math function: only `pow` (and `**`) differ; sin, cos, tan, atan, atan2, exp, log, sqrt, cbrt, hypot, asin, acos are identical (`mathprobe-node22.txt`, `mathprobe-node24.txt`).
- `outcomes.ts` gives the outcome lines (7,525 runs; zero differences).
- `worker/` is a Worker run in `wrangler dev` 4.153 (workerd 1.20261023.1): same outcome lines, and `Math.pow(13.1, 1.5)` matches Node 24.
- The full test suite on Node 22 had only `sim-trace` failing for this reason; other failures in one loaded full run passed when rerun alone.

## Not covered
- Real production workerd and browsers (Chrome, Firefox, Safari) were not run; Chrome follows V8 so it falls on one side or the other of the same change, Firefox and Safari use other engines and are untested.
- The Vultr VM itself (Broadwell) was not reachable.
- A real run with a razor-thin margin could still flip on another engine; none was found.
