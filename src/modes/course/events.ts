import { barName } from '../../sim/predict';
import { ouch } from '../../sim/landing';
import { soundsFor } from '../../ui/audio';
import type { CourseCtx } from './context';
import type { createRunStats } from './stats';
import type { createSay } from './say';

// What each step of the simulator tells the player: the sounds, the lines about the drone, the cannon, the band and the bars, the squash of a hard landing.
export function createStepEvents(ctx: CourseCtx, d: { say: ReturnType<typeof createSay>; stats: ReturnType<typeof createRunStats>; hazard: string; paintKeys: (open: boolean) => void }) {
  const { course, st } = ctx;
  const { say, stats } = d;
  let releasedAtX: number | null = null; const caughtSince = new Set<number>(); // the bars passed since the last release: a bar flown over without a grab is said to be skipped
  let squashUntil = 0, squashDepth = 1;
  let soundedEvents: unknown = null;
  return {
    reset() { squashUntil = 0; releasedAtX = null; caughtSince.clear(); },
    squash: () => (st.world.runner.tick < squashUntil ? squashDepth : 1), // how flat the body is drawn
    handle() {
      if (st.world.events !== soundedEvents) { soundedEvents = st.world.events; if (!st.replay && !st.clip.on) soundsFor(st.world.events, d.hazard); } // after the end the same events array stays: it sounds once
      for (const e of st.world.events) {
        if (e.type === 'drone-board') { say.say('The drone lifts you. Lean with ← →, climb with ↑ and come down with ↓.', 240); }
        if (e.type === 'drone-empty') { say.say('The battery ran out: the rotors stopped and the drone is falling.', 240); }
        if (e.type === 'drone-land') { say.say('The drone sets you down.', 150); }
        if (e.type === 'recoil') { say.say(`Shot! The ball flies back and you are pushed forward by ${(e.detail?.dvx as number).toFixed(1)} m/s${(e.detail?.dvy as number) > 0.5 ? ` and up by ${(e.detail?.dvy as number).toFixed(1)} m/s` : ''}.`, 180); }
        if (e.type === 'band-snap') { say.say(`The band snapped at ${(e.detail?.stretch as number).toFixed(0)} m: it can only stretch so far. Press R and turn round sooner.`, 360); }
        if (e.type === 'band-release') { say.say(`The band lets go: you leave it at ${(e.detail?.vx as number).toFixed(1)} m/s.`, 180); }
        if (e.type === 'launch-dud') { say.say('The counterweight is too light: the arm hardly moves. Try a heavier weight.', 240); }
        if (e.type === 'hang-release') { releasedAtX = st.world.runner.x; caughtSince.clear(); }
        if (e.type === 'hang-catch') caughtSince.add(e.detail?.hold as number);
        if (e.type === 'land' && releasedAtX !== null) { // a bar flown over between the release and the landing, never held: a fact, not a grade
          const skipped = (course.holds ?? []).map((h, k) => ({ h, k })).filter(({ h, k }) => !caughtSince.has(k) && h.x > releasedAtX! + 0.5 && h.x < st.world.runner.x - 0.3);
          if (skipped.length) { say.say(`You skipped the ${skipped.map(({ k }) => barName(k)).join(' and the ')}.`, 150); }
          releasedAtX = null;
        }
        if (e.type === 'jump' && st.keysOpen && !st.keysTouched) { st.keysOpen = false; d.paintKeys(false); } // the controls card has done its job once you have jumped
        if (e.type === 'bars-grab') { say.say('On the bars. Swing with → ←, then alternate Q (left hand) and T (right hand). Hold E.', 300); }
        if (e.type === 'bars-stall') { say.say(e.detail?.order ? 'Other hand first: Q, T, Q, T.' : e.detail?.both ? 'One key at a time: Q or T.' : e.detail?.end ? 'No rung ahead: let go of E to fly off.' : 'Too early: swing forward first, then reach.', 120); }
        if (e.type === 'bars-reach' && (st.world.bars?.streak ?? 0) === 6) { say.say('Smooth chain! Each catch keeps more of your swing.', 150); }
        if (e.type === 'hang-release' && e.detail?.slipped) { say.say('Your grip gave out: the bar pulled harder than your hands could hold.', 120); }
        if (e.type === 'land' && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          stats.noteLanding(o, !!e.detail?.squat);
        }
        if (e.type === 'land' && (e.detail?.impact as number) > 2 && !e.detail?.bouncy) {
          const o = ouch(e.detail?.peakDecel as number);
          squashUntil = st.world.runner.tick + 40; squashDepth = e.detail?.squat ? 0.7 : o >= 6 ? 0.6 : 0.88;
          if (o >= 3 && (say.remaining(st.world.runner.tick)) < 100) { // (a fresh 'You skipped the bar' stays)
            say.say(o >= 8 ? 'Ouch! Dangerous landing: bend your knees (↓) on big drops.' : o >= 6 ? 'Hard landing: you stumble. Hold ↓ to bend your knees.' : 'Firm landing.', 90);
          }
        }
      }
    },
  };
}
