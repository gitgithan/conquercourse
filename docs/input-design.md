# Input design: one key, many meanings

- Written for CC-240, from the owner's question about Down / S.
- Every claim below was read from the code and is pinned by `tests/key-reuse.test.ts`.

## The idea in plain words
- One key can mean several things.
- The key does not decide; the situation decides.
- Down / S is the example: on the ground at a jog it slides, in the air it bends the knees for the landing, in a drone it goes down, on the cart it brakes.
- The player learns one rule: "S means get low".
- The simulator turns that into the right move for the moment.

## Two signals from one key
- The page turns the physical key into two different signals for the simulator.
  - `squat`: true on every tick the key is down (a held state).
  - `slide`: true on one tick only, the tick of a fresh press (an event).
- A repeat while the key is held is ignored (`e.repeat`), so holding S never makes a second "fresh press".
- The simulator never sees the key; it sees `squat` and `slide` and each system reads only its own signal.

## State by key table (Down or S)
| State | What a fresh press does | What holding does |
|---|---|---|
| Running on the ground, speed at least 4 m/s, off cooldown | Slide starts: low body, speed worn down by friction | Nothing to the motion (only the pose) |
| Running on the ground, slower than 4 m/s | Nothing | Nothing |
| Slide on cooldown (0.5 s after the last one) | Nothing | Nothing |
| In the air | Nothing (the slide needs the ground) | Read at touchdown: a bent-knee landing, gentler on big drops |
| Landing tick | Squat landing only (no slide: the slide checks the state before the tick, and the runner was still in the air) | Squat landing |
| Standing still | Nothing | Nothing |
| Ground roll or vault in progress | Nothing (a roll blocks it; a jump or vault in the same tick wins) | Nothing |
| Hanging on a bar, rope or edge | Nothing | Nothing (the hand hold is the E key; Down does not let go) |
| In a drone | Nothing | Descend (Up climbs; both at once cancel) |
| Riding the cart | Nothing | Brake |
| Loaded cannon | Nothing from S | Arrow Down (not S) tilts the barrel flatter |
- The gates for the slide are in `canSlide` in `src/sim/slide.ts`: on the ground, `|vx| >= 4 m/s`, and the cooldown has passed.
- The gates are checked inside the simulator, so the page can send the signal every time and be wrong-proof.

## Can one press do two things?
- No.
- A press in the air sets `squat` (held) and `slide` (one tick).
- The slide is checked against the runner's state at the start of the tick, and the runner is still airborne, so the slide signal is spent and lost.
- The squat stays on while the key is down, so the landing is softened.
- The touchdown tick is the same: the runner is not on the ground yet when the slide is checked.
- To slide after a landing the player must press again (a new fresh press) once the feet are down.
- That second press is a new action with its own meaning, so it is not a double fire.
- Decision: this is wanted, and nothing was changed.
  - A single press never softens a landing and slides in one go, which keeps the cause of each result clear to the player.
  - A "slide into the landing" would be a new move; if we want it, it needs its own design and a replay version bump.

## Why replays stay deterministic
- A run is its keys: the log stores one bitmask per tick, run-length packed (`src/sim/replay.ts`).
- `squat` and `slide` are two separate bits in that mask.
- The meaning was settled at record time, by the state and the fresh-press rule, and the result is written down as bits.
- At replay time nothing is guessed: the simulator reads the bits and applies its own gates again, the same way, on the same state.
- The test plays a run with a slide, a held key and a squat landing, and the replay matches the live run tick by tick.

## Risks of key reuse and how we handle them
- Conflict: a press means two things at once.
  - Handled by the state gates above and by the separate signals; the table has no cell where one press does two moves.
- Surprise: the player taps S in the air and expects a slide.
  - The slide is lost, and the landing is softened; the keys card says "tap while running: slide" and "hold, on big drops".
- Held key that suddenly slides after a landing.
  - Prevented: a slide needs a fresh press, never a held key.
- Accessibility: holding and tapping the same key is hard for some players.
  - Mitigation today: the hold never has a penalty, and a tap is only needed for the slide.
  - Not done yet: a single "toggle" option, or a separate slide key.
- Remapping: the page maps two codes (ArrowDown and KeyS) to the same action.
  - A future key-rebinding screen must keep the two signals apart and remap actions, not raw codes.
- The cannon uses Arrow Down for tilt, so S and Arrow Down differ only there.
  - That is a known inconsistency, listed under limits.

## Onboarding hint
- The keys card says "Bend your knees (hold, on big drops) / tap while running: slide low under a head-high ball".
- The first-visit tour shows a "Slide" step with the S key only on courses that have head-high balls (`src/ui/onboarding.ts`).
- The hint is shown where the move matters, so the player meets the second meaning at the moment it helps.

## Limits
- Not tested in a real browser here: the key events to the two signals (`slideQueued`, held `squat`) live in the page and are not in the sim tests.
- The touch "Bend" button presses Arrow Down, so it can slide too; phone work is out of scope.
- The cannon tilt reads Arrow Down only, not S.
- One physical press on the exact tick of a coaster or drone entry is not covered by a test.

## How to make it better
- Add a short on-screen cue the first time a fresh press is lost in the air.
- Show the slide as its own row on the keys card, so the second meaning is named.
- Let the cannon tilt read S too, so S and Arrow Down match everywhere.
- Add a rebinding screen that remaps actions (bend, slide) and not raw key codes.
- If a "slide into the landing" is wanted, make it a new move with its own bit and a replay version bump.
