# Lesson: test on a different machine

*A shareable lesson from CC-133.*
*The numbers below are real; the picture uses made-up digits to show the idea.*

## So what
- Our promise is "same keys, same result".
  - A friend can replay your run.
  - The server can prove you cleared a course by replaying your keys.
- We tested that promise on a second machine with another Node version, and in Cloudflare's runtime.
- The outcome held: 7,525 runs gave the same tick count, the same clear or fall, and the same end place on Node 22, Node 24 and local `workerd`.
- The exact bits did not hold: the fingerprint (hash) of a run differs between Node 22 and Node 24 on six courses.
- So the rule for the game is:
  - Judge a run by its outcome.
  - Compare bit-for-bit fingerprints only on one engine family, or make the sim bit-exact first.

![Same keys, three machines, same outcome, a different last digit](evidence/lessons/same-keys-two-machines.svg)

## 1. Why test on another machine
- A game that only runs well on the author's laptop is not a shared game.
- The question we ask is narrow:
  - Can a friend on another browser replay your run and see the same thing?
  - Can the server on Cloudflare replay your keys and agree you cleared?
- Our sim has no random numbers and a fixed time step, so on paper the answer is yes.
- On paper is not a test; so we ran the same code on a different CPU, a different Node version and a different runtime.

## 2. What we found
- Outcomes were identical in 7,525 runs.
  - That is every shipped course, the ideal plan, and 300 key-mash seeds each.
  - Node 22 (V8 12.4) against Node 24 (V8 13.6).
  - The 1,806 runs on the six affected courses also matched in `workerd`.
- Bits were not identical on six courses.
  - plank and plank-two (beam bending), drone (rotor power), lache, lache-wide and training (cart rails or vault curve).
  - The gap starts in the 16th digit.
  - After a plank walk it grows to about 1e-13 in speed.
  - That is far too small to flip a clear in any run we tried.
- The CPU was not the cause.
  - The failure that first showed on the VM reproduced on the laptop with the same Node 22.

## 3. Where differences can come from, in general
- **The JavaScript engine version.**
  - What we hit: `x ** 3` and `Math.pow(x, 1.5)` round one step differently in V8 12.4 and V8 13.6.
- **Math functions the spec lets differ.**
  - `sin`, `cos`, `exp`, `pow` and friends may give slightly different last digits on different engines.
  - `+ - * /` and `sqrt` are exact by the IEEE rule, so they are the same everywhere.
- **CPU float habits.**
  - Old x87 chips used extra-wide registers; modern SSE does not.
  - A fused multiply-add (FMA) rounds once instead of twice.
  - JavaScript engines rarely expose this, but compiled code (WebAssembly, C, GPU) can.
- **Sort order.**
  - A sort that is not stable can order equal items differently.
- **Maps and sets.**
  - If you loop over a hash map whose order is not fixed, results can change.
  - JavaScript `Map` keeps insertion order, which is safe.
- **Time and place.**
  - `Date`, time zone and locale (for example how numbers print) differ between machines.
- **Threads and GPUs.**
  - Adding numbers in a different order gives a different last digit.
- **Other browsers.**
  - Firefox (SpiderMonkey) and Safari (JavaScriptCore) are different engines; we did not run them.

## 4. How we found it
- A fingerprint after every tick (`dump.ts`), not just at the end.
  - A failing end hash says "different"; a per-tick hash says when.
- A first-difference tool (`firstdiff.mjs`).
  - It named the tick and field: tick 292 on drone (`drone.power`, one unit in the last place) and tick 628 on plank (`runner.y`).
- A Math probe (`mathprobe.mjs`).
  - It hashes 200,000 results per Math function on each Node.
  - Only `pow` and `**` differ; sin, cos, tan, atan, atan2, exp, log, sqrt, cbrt, hypot, asin and acos match.
- The same commit on both Node versions.
  - Same code, different engine, different result: that rules out our own change.
- A Worker in `wrangler dev` for the Cloudflare side.
  - It gave the same outcome lines, and `Math.pow(13.1, 1.5)` matched Node 24.

## 5. The rules we take
- In the sim step, use only `+ - * /` and `Math.sqrt` where you can.
  - Avoid `**` above 2 and `Math.pow`.
  - If you must use a fuzzy function, accept a tolerance.
- The trace test (`tests/sim-trace.test.ts`) checks tick count and outcome on every engine, and the stored hash only on V8 13.x.
- The option we did not take yet: `data/eval/trace-machines/pow-fix.patch`.
  - `x ** 3` becomes `x * x * x`.
  - `Math.pow(T, 1.5)` becomes `T * Math.sqrt(T)`.
  - With it, Node 22 and Node 24 gave identical states at every tick of all 75 mash runs.
  - The cost: the stored golden hashes of the six courses change, so they need `UPDATE_GOLDEN` and a note in the pull request.
  - The risk: a clear on a razor-thin margin could move by a tick, so recorded runs and plans must be rechecked after regenerating.
  - It is the product owner's call.

## 6. What this does not cover
- Real production `workerd`; we ran it locally.
- Chrome, Firefox and Safari.
  - Chrome follows V8, so it lands on one side of the same change.
  - Firefox and Safari use other engines and are untested.
- The original VM itself was shut down; we reproduced its failure on the laptop.
- A run with a razor-thin margin could still flip on another engine; we found none.

## Try it yourself
- Run the probe on two Node versions and compare the files: `data/eval/trace-machines/mathprobe.mjs`.
- Full numbers and scripts: [data/eval/trace-machines/README.md](../data/eval/trace-machines/README.md).
- The short entry in [lessons](lessons.md).
