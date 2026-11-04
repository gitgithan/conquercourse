import type { InputLog } from '../../sim/replay';
import { logTicks } from '../../sim/run-checks';
import { courseHash, encodeLog } from '../../sim/replay';
import { track, trackCourseEvent, publishClear, sendClear } from '../../ui/feedback';
import { statsOn } from '../../ui/course-stats';
import { announceBest, boardOn, rememberBest, type BoardHooks } from '../../ui/leaderboard';
import type { createGhost } from '../../ui/ghost';
import type { Onboarding } from '../../ui/onboarding';
import type { CourseCtx } from './context';
import type { Analytics } from './fall';
import type { createFeed } from './feed';
import type { createIdealRun } from './ideal';
import type { createRunStats } from './stats';
import type { createSay } from './say';
import type { createHud } from './hud';
import { showClearedReport } from './report';

export interface OutcomeDeps {
  params: URLSearchParams;
  panel: HTMLElement;
  say: ReturnType<typeof createSay>;
  stats: ReturnType<typeof createRunStats>;
  analytics: Analytics;
  runLog: Parameters<typeof showClearedReport>[0]['runLog'];
  hardBand: ReturnType<typeof createHud>['hardBand'];
  addHardest: ReturnType<typeof createHud>['addHardest'];
  listedKey: () => string | null;
  viewHooks: () => BoardHooks;
  ideal: ReturnType<typeof createIdealRun>;
  feed: ReturnType<typeof createFeed>;
  loadedIsDefault: boolean;
  botMode: boolean;
  onFall: (what: 'splash' | 'hurt' | 'stall') => void;
  ghostCtl: () => ReturnType<typeof createGhost> | null;
  onboarding: () => Pick<Onboarding, 'onCleared' | 'onFall'>;
  choice: () => 'a' | 'b';
  restart: (x?: number) => void;
  openDojo: () => void;
  makeClip: (log: InputLog, ticks: number, from?: number) => Promise<void>;
}

// What happens when a step ends the run: the fall panel, the line about a missed wall, the friend's run played again, and the report of a cleared run (which also offers the run to the board).
export function createOutcome(ctx: CourseCtx, d: OutcomeDeps) {
  const { course, st, log } = ctx;
  const { params, panel, stats, analytics, runLog, hardBand, addHardest, listedKey, viewHooks, ideal, feed, loadedIsDefault, botMode, onFall } = d;
  const say = d.say.say;
  // CC-149: a cleared run on a listed course is offered to the server, which plays the keys again before it counts (a run with anything but plain keys has no log and is not offered)
  let lastClear: BoardHooks['publish'] | null = null;
  function offerClear() {
    lastClear = null;
    const bk = listedKey();
    if (!statsOn(params) || botMode || st.demo || st.idealWhole || !bk) return;
    const mine = d.ghostCtl()?.myRun();
    if (mine) {
      if (boardOn(params)) { rememberBest(bk, courseHash(course), logTicks(mine)); announceBest(); } // every board box redraws Your best now
      const runId = analytics.runId, ticks = logTicks(mine), keysReady = encodeLog(mine);
      void keysReady.then((keys) => sendClear(bk, runId, courseHash(course), keys, ticks)); // counted only; the board gets it when the player clicks Publish (CC-108)
      lastClear = { ticks, send: (nick) => keysReady.then((keys) => publishClear(bk, runId, courseHash(course), keys, ticks, nick)) };
    }
  }
  return (prev: string) => {
    if (prev === 'running' && st.world.outcome === 'splash') onFall('splash');
    if (prev === 'running' && st.world.outcome === 'hurt') onFall('hurt');
    if (prev === 'running' && st.world.outcome === 'stalled') onFall('stall');
    if (st.world.events.some((e) => e.type === 'wall-slide')) { // CC-182: missing the top is not a fall: the body slides to the foot and the run goes on, run up again as often as you like
      say([...log].some((e) => e.type === 'wall-no-grip') ? 'Your hands missed the edge. Run up again and hold E near the top.' : 'Not high enough. Run up again with more speed.', 240);
    }
    if (st.phoneWatch && prev === 'running' && st.world.outcome === 'cleared') { // the friend's run, watched on a phone: no report, no What next card; play it again in a moment (CC-138)
      const again = st.phoneWatch;
      setTimeout(() => { if (again) { d.restart(course.startX); feed.play(again); } }, 2500);
    } else if (prev === 'running' && st.world.outcome === 'cleared' && !st.clip.on) {
      if (!st.plan && !st.demo && !st.idealWhole) { stats.clearFinishZone(st.world.runner.x); ctx.everCleared = true; track('clears'); stats.finishRun(true, analytics.runId); trackCourseEvent('success', analytics.courseKey, course.name, analytics.runId, analytics.mode); } // an Ideal run is watched, not played: it is not counted
      offerClear();
      try { localStorage.setItem('cc.course.cleared', '1'); } catch { /* ok */ }
      panel.innerHTML = ''; panel.style.display = 'grid';
      showClearedReport({
        course, params, panel, runLog, hardBand, addHardest, listedKey, viewHooks, clearedNote: ideal.clearedNote,
        get world() { return st.world; }, get runKind() { return stats.kind; }, get ghostCtl() { return d.ghostCtl(); }, get lastClear() { return lastClear; },
        get demo() { return st.demo; }, botMode, get idealWhole() { return st.idealWhole; }, loadedIsDefault, get analyticsRunId() { return analytics.runId; },
        get onboarding() { return d.onboarding(); }, get choice() { return d.choice(); },
        restart: (x) => d.restart(x), startIdeal: (x0, z) => ideal.startIdeal(x0, z), openDojo: () => d.openDojo(), makeClip: (l, t, f) => d.makeClip(l, t, f),
      });
    }
  };
}
