# Learning design: how the game teaches

*Draft v0.1, 2026-10-27; knowledge from the practice project (`docs/PRIOR-WORK.md`).*
*Reference, not requirements: the spec decides; numbers are starting points to re-measure.*
*Loop names: Course (fast run), Dojo (one obstacle, slow), Park (real world), Builder (courses for others).*

## Who learns and how (the product owner's answers)
- **Audience:** about 13 and up; the ceiling is the H2 Physics A-level formula sheet, and the simpler formulas it assumes are not assumed here.
  - Players who already know a relationship can skip its discovery and just play ("I know this"), never blocked. → Dojo.
- **Setting:** played alone at home; teachers review recorded sessions later. → every mode records.
- **Words:** at most two short sentences per prompt; everyday words; a physics word only after the player has found the idea.
- **Units:** metric only.
- **No formulas anywhere,** including anything an AI produces; players say relationships in words.
- **Mass is a knob like any other,** because hiding it would hint the answer; it matters in at least one place (for example sinking or springs) so it isn't a fake control.
- **Predictions are generous:** drag a marker, not type a number; pass within a wide band (about ±25 %, tunable) or on the right direction; unlimited retries; never blocking.
  - Difficulty levels change only the tolerance (Hard = a tighter band).
- **No calculator:** graphs, ratios and approximations do the arithmetic ("speed ×2.0 → height ×3.9").
- **Every value is editable, no limits,** with two exceptions decided later: gravity stops at zero, and records count only on Earth rules.
  - Absurd values show a real-world comparison ("that's 40 times Earth's gravity") instead of refusing them; the simulation must survive any finite value.
- **Failure is falling into water:** cheap, clear, instantly retried.
- **Safety warnings** wherever the real world is involved (the Park): low heights, soft ground, no stunts.
- **Minimal accessibility:** keyboard play, readable text, never colour as the only signal.
- **Not allowed this year:** a chat tutor, or anything that grades a person's technique.

## Principles that carry the learning
*Principle IDs refer to the practice project's book cards; the idea matters, not the citation.*
- **Freedom to fail (RES-1):** failure must be cheap and informative; water, instant retry, nothing lost from the record. → Course, Dojo.
- **Information balancing (SYL-6):** show enough to decide, never the answer; hints suggest an experiment, not a result. → Dojo.
- **The probing cycle (GEE-1):** act, see data, form a hunch, test it; this is the Dojo's loop.
- **Information just in time (GEE-2):** explanations appear only after the player has data, and only on demand.
- **Fair tests by default:** the views make "change one thing, keep the rest" the natural way to compare (filters, ghosts tagged with what changed).
- **Every rule changes behaviour:** a new mechanic changes how players and scripted test players act; playtest after each one.
- **The most useful book for this kind of game was the one written for learning games;** start from it (and from Gee) when in doubt.

## Patterns on screen, and why they work
| Pattern | What the player sees | Why it works | Where |
|---|---|---|---|
| **Ghost trails** | Earlier runs as flat, translucent silhouettes with their path, each tagged with what was different | Comparison by perception, not memory (working memory holds about four items); side-by-side cases that differ in one feature show which feature matters | Course (best run, ideal run), Dojo |
| **Scrubbable timeline** | Pause and drag time; the run and every ghost move together; readouts update | Direct, reversible manipulation shrinks the gap between doing and understanding; a one-second jump becomes something to inspect | Dojo |
| **Up and down the ladder of abstraction** | One run → its trail → a sweep of ten ghosts → a graph → a sentence | Concrete first, abstract later ("concreteness fading") transfers best | Dojo |
| **Predict, observe, explain** | Drag a marker before the run; see marker vs result | Self-generated guesses are remembered; surprise drives learning; confident errors corrected stick best, so being wrong costs nothing | Dojo, Park |
| **Immediate feedback** | A changed knob applies to the very next run, shown on its ghost label | Cause and effect is learned when the effect follows within about a second | Dojo, Builder |
| **Information on demand** | One-line hints, pattern cards only after data, skip for experts | Explanations help novices and hurt experts; on demand serves both | Dojo |
| **Ratios instead of arithmetic** | Pick two runs: "×2 → ×4" | Offloads the division so the player thinks in proportions | Dojo |
| **One nudge after a miss** | The one knob that matters, as buttons, in words | A racer gets what to change without a table | Course |
- **Ghosts stay silhouettes:** their job is where and when, not looks; it keeps up to six cheap on school laptops and the player's own character the clear focus.
- **The run log is the single source** for ghosts, the timeline, graphs, the teacher's review and any AI summary: knob values, sampled states at the simulator's rate, derived measures (peak, airtime, distance, landing speed and force) and events (predictions, outcomes, skips).
  - One format to test, one to share.

## The concept ladder and the course story
- **Relationships in words (what players learn to say):** no effect · goes up steadily · goes up faster and faster · goes up but slows down · goes down · swings back and forth · shrinks by halves; each has a graph shape players learn to recognise.
- **The ladder (foundations first, then the A-level sheet), the relevant rungs for v1 obstacles:**
  - speed (distance in the same time); steady speeding up while falling; weight vs mass (heavier weighs more but falls the same); speed ↔ height swap (double speed, four times height); springs (push harder, squash more); pendulum (longer rope, slower swing; mass no effect); landing force (bend more, softer landing); timing and relative motion;
  - A-level: jump height grows with the square of take-off speed (and braking distance with the square of speed: the same law); fall distance grows with the square of time, and air time doesn't depend on run speed.
- **Grade bands** label each rung (lower secondary, upper secondary, pre-university, extension) so teachers and players can pick a level.
- **The rule for adding an obstacle (keeps the story coherent):**
  - it reuses at least one relationship the player measured earlier (their own notebook page);
  - it adds exactly one new relationship or twist;
  - it's built mostly from existing mechanics and primitives (course data plus one balance test, not a new physics module).
- **The notebook:** each Dojo adds a page with the player's own measured relationship in words and a small graph; later obstacles ask them to use it; a sloppy (unfair) experiment predicts badly, and the player sees why.
- **The story:** one Grand Course; each obstacle is solved with what was learned before; the finale is planned from the notebook in one predicted attempt.
- **One deliberate twist:** after "mass never matters" in jumps and swings, one obstacle where it does (sinking, springs), to stop the overgeneralisation.

## Pace: racers and thinkers ("Train slow. Run fast.")
- **Most students start as racers;** the game must be fun as a race first, and the physics must help you race, so racers become experimenters without being told.
- **Course:** Earth rules locked; only the "plan" knobs a real athlete controls (start, run-up mark, effort); clock, splits, ghosts of your best and the ideal run; records and trophies.
- **Dojo:** every value editable; no clock; this is where notebook pages are measured.
- **Pulls from race to physics:** shortcuts that need a prediction (a riskier route you may attempt once your notebook says it clears); near-miss messages that say what to change; a free hint after three fails on one obstacle; experiments optional, never a wall.
- **Pace targets to measure and tune:** first jump under 10 s after the page loads; first obstacle under 60 s; something new on screen every 60-90 s; one obstacle 1-2 minutes on average with at most three fails before a hint; the spec's first clear of a short course within 3 minutes.
- **Measure pace with a pace bot** (a scripted average player with a time budget per obstacle in the browser tests), the ideal run (the best possible time), session logs, and one watched player per change.

## Easy to play, still honest physics
- **Each key changes one physical quantity** (copied from Worms' ninja rope): jump catches and releases; up and down climb and slide on the rope (length changes, spin about the anchor is kept); left and right lean and pump (adds energy, most at the bottom).
- **Keyboard for moving, mouse only for tools** (graphs, timeline, knobs): timing and rhythm are the skill, which keys express well; laptops and trackpads at school.
- **A catch keeps only the speed across the rope;** the part along it is lost (an inelastic catch), shown as "the rope took some of your speed".
- **Hands and plans:** keys during a run are skill; knobs before a run are understanding; the more an obstacle relies on the plan, the more it teaches.
- **Forgiving input must never fake physics:** an early jump press may be buffered, but nothing in the air changes the flight; the practice project removed a late-jump "coyote" allowance and air steering because they broke the lesson that the jump is decided at take-off.
- **Holding several keys as "limbs in contact" (climbing)** could teach force balance, but many laptop keyboards can't register four keys at once; keep it for later, on two keys.

## Human ranges for obstacle sizes
- **Flat-ground take-off keeps vertical and horizontal independent:** run speed carries you across a gap, jump effort sets the height; only a curve (the warped wall, a ramp) turns run speed into height.
  - Real athletes couple them with a plant step, but mixing two variables breaks the fair test for 13-year-olds; this is a deliberate simplification, stated in the Dojo.
- **Starting sizes to re-measure against the rookies' reach and the simulator:** warped wall top about 4 m to 4.6 m with hands reaching about 2.1 m above the hips; rope caught about 5 m below its anchor; gaps that a sprinting adult clears with a small margin; landing decks wide enough to stop on with grip-limited braking.
- **Primitives (the practice project's set):** platform, gap, wall, ramp/curve, spring, rope anchor, moving hazard, water; each declares the one relationship it teaches and its editable sizes.

## Sharing safely (Builder, Park)
- **Private by default:** every photo-built or edited course starts private; sharing is one explicit, confirmed action; unsharing can't recall copies, so it's treated as one-way.
- **Stripped before storing:** raw photos, camera metadata, GPS and local paths; a shared course holds only primitives with sizes and content-hashed stylised skins, never the source photo.
- **Remix with credit:** only shared courses can be remixed; a remix starts private, records its parent and a credit chain of every ancestor, and carries an open licence (CC BY 4.0 in the practice project).

## A few challenge ideas worth keeping (inspiration, numbers approximate)
- **Engineered stunts** fit a physics game because every one was computed before anyone jumped: timing a gap between moving vehicles (relative motion), car and bike distance jumps (range grows with speed squared; mass doesn't change the arc), stopping on a short platform (braking), cliff diving (about 3 s of fall, the time to act).
- **A floating obstacle course where every mistake ends in water** matches our failure rule.
- **Keep it Earth-only and safe:** these inspire Course and Builder challenges; the Park never asks for risky real attempts.

## Process: test with a person early
- **One human over-the-shoulder test in the first days,** before polishing; the practice project skipped it and every experience question stayed a guess.
- **Physics first, graphics later:** law tests caught bugs before any pixel was drawn.
- **Automated playtests find design problems, not just bugs** (for example, mixing two worlds in one graph led to the fair-test filter).
- **Write tests against game time from the start** (software rendering is slow).
- **A decision log lets unattended work continue** while every choice stays visible to revisit.
- **Day plan that worked, compressed:** day 1 a one-sheet, risks, and a spike of the riskiest model call; day 2 a graybox of the core loop plus one watched player; days 3-6 build in loops, riskiest first, with tests for anything that could teach something false; day 7 playtest and cut what isn't integral; day 8 polish only the demo path; day 9 the video, README and decision log.
