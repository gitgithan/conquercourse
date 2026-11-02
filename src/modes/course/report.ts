import type { CourseData } from '../../course/course';
import type { WorldState } from '../../sim/world';
import type { HardBand } from '../../ui/run-report';
import type { InputLog } from '../../sim/replay';
import type { BoardHooks } from '../../ui/leaderboard';
import type { Onboarding } from '../../ui/onboarding';
import type { createGhost } from '../../ui/ghost';
import type { RunLog } from '../../ui/run-report';
import { setMusicScreen } from '../../ui/music';
import { courseTooBig, makeLinkInfo, shareOn } from '../../share/challenge';
import { clipFits } from '../../share/clip';
import { shareButtons } from '../../share/share-ui';
import { organiseReport, reportSectionsOn } from '../../ui/report-sections';
import { courseHash, encodeLog, startOfX } from '../../sim/replay';
import { logTicks } from '../../sim/run-checks';
import { session } from '../../ui/feedback';
import { boardKeyOfPage, boardPathOf, FIRST_COURSE_KEY } from '../../share/board-courses';
import { challengeOn } from '../../share/challenge-course';
import { challengeLink, registerCourse } from '../../share/challenge-client';
import { challengeStrip } from '../../ui/challenge-card';
import { madeCourse } from '../../share/made-course';
import { boardBox, boardOn, publishStrip } from '../../ui/leaderboard';
import { pathsOn, waysOf } from '../../ui/paths';
import { bestLine, buildReport, renderReport } from '../../ui/run-report';
import { currentWorld, DEMOS, WORD_VALUES, worldHref } from '../../ui/world-picker';
import { pageSearch } from '../../flags';

// What the cleared-run report reads and changes in the course closure. The values read here are the ones at the moment of the clear; `choice` is read when a link is made, so it stays an accessor.
export interface ClearedReportCtx {
  readonly course: CourseData;
  readonly world: WorldState;
  readonly params: URLSearchParams;
  readonly panel: HTMLElement;
  readonly runLog: RunLog;
  readonly runKind: string;
  readonly ghostCtl: ReturnType<typeof createGhost> | null;
  readonly lastClear: BoardHooks['publish'] | null;
  readonly demo: { x1: number } | null;
  readonly botMode: boolean;
  readonly idealWhole: boolean;
  readonly loadedIsDefault: boolean;
  readonly analyticsRunId: string;
  readonly onboarding: Pick<Onboarding, 'onCleared' | 'onFall'>;
  readonly choice: 'a' | 'b';
  hardBand(): HardBand | null | undefined;
  addHardest(body: HTMLElement): void;
  listedKey(): string | null;
  viewHooks(): BoardHooks;
  restart(x?: number): void;
  startIdeal(x0: number, zoneId: string | null): Promise<void>;
  openDojo(): void;
  makeClip(log: InputLog, ticks: number, from?: number): Promise<void>;
  clearedNote(): void;
}

export function showClearedReport(c: ClearedReportCtx) {
  const { course, world, params, panel, runLog, runKind, ghostCtl, lastClear, demo, botMode, idealWhole, loadedIsDefault, analyticsRunId, onboarding, hardBand, addHardest, listedKey, viewHooks, restart, startIdeal, openDojo, makeClip, clearedNote } = c;
        const ghostLine = ghostCtl?.reportLine(world.runner.tick) ?? null;
        const ways = pathsOn(params) && runKind === 'attempt' ? waysOf(course, runLog.path) : null; // CC-225: the way taken, and the best line of that way
        const rep = buildReport(course, runLog, world, runKind === 'attempt', bestLine(course, ways?.takenPlan ?? undefined));
        if (ways) rep.ways = ways;
        const courses = DEMOS.filter((d) => !WORD_VALUES.includes(d[0])), here = courses.findIndex((d) => (d[0] || null) === currentWorld(params, course.name).value), nxt = courses[here + 1];
        const body = renderReport(course, runLog, rep, {
          again: () => restart(course.startX),
          watch: course.plan ? () => { panel.style.display = 'none'; void startIdeal(course.startX, null); } : undefined,
          next: here >= 0 && nxt ? { name: nxt[1].split(':')[0], go: () => { location.href = worldHref(nxt[0]); } } : undefined,
          close: () => { panel.style.display = 'none'; },
        }, false, ghostCtl?.reportPath() ?? null, !reportSectionsOn(params), hardBand());
        addHardest(body);
        { const bk = listedKey(); if (boardOn(params) && !botMode && !demo && !idealWhole && bk) { body.querySelector('#report-actions')?.before(boardBox(bk, courseHash(course), session(), viewHooks())); if (lastClear) body.querySelector('h2')?.after(publishStrip(lastClear, bk, courseHash(course))); } } // CC-108: the name and Publish sit at the top, next to the result
        const myRunNow = ghostCtl?.myRun() ?? null;
        if (!lastClear && world.outcome === 'cleared' && myRunNow && challengeOn(params) && !botMode && !demo && !idealWhole && !listedKey() && madeCourse(course)) { // CC-108: not a ranked course: say why, and offer a challenge course or the official one
          const rankedBase = boardKeyOfPage(params), startedRanked = !!rankedBase && (rankedBase !== FIRST_COURSE_KEY || loadedIsDefault) && !['made', 'generate', 'coaster', 'cid'].some((k) => params.has(k)), keysP = encodeLog(myRunNow), runId = analyticsRunId, mineLog = myRunNow, played = course;
          body.querySelector('h2')?.after(challengeStrip({
            changed: startedRanked,
            publish: async () => registerCourse(played, session(), runId, await keysP, logTicks(mineLog)),
            link: (id) => challengeLink(location.origin, id, played, mineLog, localStorage.getItem('cc.nick') ?? '', c.choice),
            official: () => { location.href = worldHref((rankedBase && boardPathOf(rankedBase)) ?? ''); },
          }));
        } else if (!lastClear && world.outcome === 'cleared' && (ghostCtl?.myRun() || ghostCtl?.myClip()) && !body.querySelector('#report-publish') && !botMode && !demo && !idealWhole) { // a clear that cannot be published: the button is off and the reason sits next to it
          const listed = !!listedKey();
          const why = !listed ? 'Only runs on the listed courses can be published.' : !ghostCtl?.myRun() ? 'Only full runs from the start of the course can be published.' : !boardOn(params) ? 'The leaderboard is switched off here.' : 'This run cannot be published.';
          body.querySelector('h2')?.after(publishStrip({ ticks: world.runner.tick, send: async () => ({ published: false }) }, listedKey() ?? '', courseHash(course), why));
        }
        if (ghostLine) body.querySelector('#report-ghost-slot')?.append(ghostLine);
        if (shareOn(params) && !botMode && !demo && !idealWhole && !params.get('mode')) {
          const mine = ghostCtl?.myRun() ?? null, mineClip = ghostCtl?.myClip() ?? null, ticks = world.runner.tick; // a link needs a run from the start; a clip can be made of any try (CC-157)
          const partialStart = !mine && mineClip ? startOfX(course, mineClip.from) : null, partial = partialStart && mineClip ? { log: mineClip.log, start: partialStart } : null; // CC-242: a cleared run from a checkpoint can be shared with its start; it never reaches a board
          if (mine || mineClip) body.querySelector('#report-actions')?.append(...shareButtons({ link: mine ? (nick) => makeLinkInfo(location.origin, pageSearch(), course, mine, nick, c.choice) : partial ? (nick) => makeLinkInfo(location.origin, pageSearch(), course, partial.log, nick, c.choice, 'done', undefined, partial.start) : undefined, courseTooBig: () => courseTooBig(pageSearch(), course), clip: mineClip && clipFits(ticks) ? () => void makeClip(mineClip.log, ticks, mineClip.from) : undefined }));
        }
        if (reportSectionsOn(params)) organiseReport(body, !botMode && !demo && !idealWhole ? { dojo: () => openDojo() } : {}); // CC-158
        setMusicScreen('report');
        panel.append(body); (body.querySelector('#report-again') as HTMLElement | null)?.focus({ preventScroll: true });
        if (!botMode && !demo && !idealWhole || params.get('next') === '1') onboarding.onCleared(panel); // CC-100: the one-time What next card, at the top of the report
        if (!botMode && !demo && !idealWhole && !rep.saving) clearedNote(); // a shortcut, if the simulator knows one (a fact, never a grade)
}
