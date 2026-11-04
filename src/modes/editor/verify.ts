import { BLOCKED_LANE_GUIDANCE } from '../../ui/editor-actions';
import { adviseMachine } from '../../slice/fix-launch';
import { adviseLane } from '../../slice/advice';
import { adviceInWorker } from '../../slice/proof-client';
import { describe as describeLane } from '../../slice/slice';
import { isStopped } from '../../slice/lane-check';
import type { LaneCheck } from '../../slice/lane-check-ui';
import type { CourseData } from '../../course/course';
import type { createLane } from './lane';
import type { EditorSearch } from './search';
import type { createHelper } from './helper';
import type { EditorState, P } from './state';

type Lane = ReturnType<typeof createLane>;
type Helper = ReturnType<typeof createHelper>;

// laneCheck is made after this module in editor.ts, so it comes as a callback.
export interface VerifyEnv {
  proofFor?: EditorSearch['proofFor'];
  ed: EditorState; lanePanel: HTMLElement; laneCheck: () => LaneCheck;
  searchClearable: (course: CourseData) => Promise<boolean | null>; stopSearch: () => void;
  currentProfile: Lane['currentProfile']; laneCourse: Lane['laneCourse']; coursePieces: Lane['coursePieces'];
  machineNow: Lane['machineNow']; trebuchetPivot: Lane['trebuchetPivot']; machineWrap: Lane['machineWrap']; barsNow: Lane['barsNow'];
  adviceBox: Helper['adviceBox']; setSuggest: Helper['setSuggest']; showAdvice: Helper['showAdvice'];
}

// The lane check: after an edit stops, wait, then ask the simulator whether the lane clears and write the verdict and the advice.
// Moved out of editor.ts unchanged (CC-133).
export function createVerify(env: VerifyEnv) {
  const { ed, lanePanel, searchClearable, stopSearch, currentProfile, laneCourse, coursePieces, machineNow, trebuchetPivot, machineWrap, barsNow, adviceBox, setSuggest, showAdvice } = env;
  let verifyTimer = 0, adviceRun = 0, verifyVersion = 0;
  function interruptSearch() {
    clearTimeout(verifyTimer);
    verifyVersion++;
    // Keep useful work running while the user rotates or drags. The result is
    // version-checked and discarded if the course changed; verify() restarts
    // for the settled course after the debounce.
  }
  function verify(pause = 800) {
    interruptSearch();
    env.laneCheck().reset(); // CC-243: an edit throws the last verdict away; the new search starts only after the pause, and the old worker is ended when the new one starts
    const version = verifyVersion;
    document.documentElement.dataset.lane = JSON.stringify({ angle: ed.angle, offset: ed.offset, level: ed.level }); // for the checks: the lane being verified
    const check = async () => {
      const p = currentProfile();
      if (p.length < 8) { stopSearch(); ed.verdict = 'Nothing is in the lane: move the lane or the pieces.'; }
      else {
        const r = describeLane(p);
        const course = laneCourse(p), proof = env.proofFor?.(course);
        const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
        let clear: boolean | null;
        if (proof) { stopSearch(); env.laneCheck().start(); clear = proof.cleared; }
        else {
          ed.verdict = 'Checking this lane…';
          if (v) { v.textContent = ed.verdict; v.className = 'says-when muted'; }
          env.laneCheck().start();
          clear = await searchClearable(course);
        }
        if (version !== verifyVersion || isStopped(env.laneCheck().state())) return; // a newer edit, Cancel or the cap answered for this check
        if (clear === null) { env.laneCheck().reset(); ed.verdict = 'The lane check could not finish. Try again after editing stops.'; document.documentElement.dataset.verdict = ed.verdict; if (v) { v.textContent = ed.verdict; v.className = 'says-when bad'; } return; }
        env.laneCheck().done(clear);
        document.documentElement.dataset.laneClear = clear ? '1' : '0'; setSuggest(clear);
        ed.verdict = clear ? `The simulator can clear this lane (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(0)} m).` : BLOCKED_LANE_GUIDANCE;
      }
      const v = lanePanel.querySelector('#verdict') as HTMLElement | null;
      if (v) { v.textContent = ed.verdict; v.className = ed.verdict.startsWith('The simulator can clear') ? 'says-when ok' : 'says-when bad'; }
      document.documentElement.dataset.verdict = ed.verdict;
      // when it cannot be cleared, say what to shift (each suggestion was proved by the simulator)
      ed.adviceList = []; showAdvice();
      if (machineNow() && p.length >= 8) { // a trebuchet at the start: its counterweight and arm come first, and a narrow release window gets a pin
        const mine = ++adviceRun, m = machineNow()!, lane = { angle: ed.angle, offset: ed.offset, level: ed.level }, clear = ed.verdict.startsWith('The simulator can clear');
        setTimeout(() => { if (mine !== adviceRun) return; ed.adviceList = adviseMachine(coursePieces(), lane, m, { budgetMs: 8000, max: 1 }, trebuchetPivot()); if (!clear && !barsNow().length) ed.adviceList.push(...adviseLane(coursePieces(), lane, { wrap: machineWrap(m) })); showAdvice(); if (!ed.adviceList.length) adviceBox.textContent = clear ? '' : 'No single change to the machine or a piece clears it. Choose Ask AI for ideas to look further.'; document.documentElement.dataset.advice = String(ed.adviceList.length); }, 30);
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8 && barsNow().length) {
        adviceBox.textContent = 'This lane has bars. Drag them in the side view (position and height), or choose Make it easier to try small moves of the bars.';
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8 && ed.pieces.some((q) => q.role && q.role !== 'ground')) {
        adviceBox.textContent = 'This lane uses roles (wall, rope anchor or trampoline bed). Open Moves to see what each needs, or choose Ask AI for ideas.';
      } else if (!ed.verdict.startsWith('The simulator can clear') && p.length >= 8) {
        const mine = ++adviceRun;
        adviceBox.textContent = 'Working out what to shift…';
        setTimeout(async () => { if (mine !== adviceRun) return; const got = await adviceInWorker(coursePieces() as P[], { angle: ed.angle, offset: ed.offset, level: ed.level }).catch(() => null); if (!got || mine !== adviceRun) return; ed.adviceList = got; showAdvice(); if (!ed.adviceList.length) adviceBox.textContent = 'No single small shift clears it. Choose Ask AI for ideas to ask Muse Spark Open.'; document.documentElement.dataset.advice = String(ed.adviceList.length); }, 30);
      } else document.documentElement.dataset.advice = '0';
    };
    // Apply can reuse the preview proof immediately, without a new worker or a checking message.
    if (env.proofFor?.(laneCourse())) void check();
    else verifyTimer = window.setTimeout(() => { void check(); }, pause);
  }
  return { interruptSearch, verify, verifyVersion: () => verifyVersion };
}
