import { HAZARD_INFO } from '../../course/hazard';
import { OBSTACLES } from '../../course/obstacles';
import { recoilParams } from '../../sim/world';
import { isAimable } from '../../sim/recoil';
import { startOfX } from '../../sim/replay';
import { buildReport, renderReport } from '../../ui/run-report';
import { reportSectionsOn } from '../../ui/report-sections';
import { copyLinkButton } from '../../share/share-ui';
import { clipFits } from '../../share/clip';
import { courseTooBig, makeLinkInfo, shareOn } from '../../share/challenge';
import { track, trackCourseEvent } from '../../ui/feedback';
import { pageSearch } from '../../flags';
import type { Ghost } from '../../ui/ghost';
import type { Onboarding } from '../../ui/onboarding';
import { bandTip, buildDiag, cartDiag, cartTip, plankTip, windowTip } from './tips';
import type { CourseCtx } from './context';
import type { createRunStats } from './stats';
import type { createIdealRun } from './ideal';
import type { createNav } from './nav';
import type { createClipMaker } from './clip';

export type Fall = 'splash' | 'slide' | 'hurt' | 'stall';
type MakeClip = ReturnType<typeof createClipMaker>;

// The numbers that go with one try: one run id per try, and whether its fall was already counted.
export interface Analytics { courseKey: string; mode: string; runId: string; failed: boolean }

export interface FallDeps {
  ctx: CourseCtx;
  params: URLSearchParams;
  panel: HTMLElement;
  diagBox: HTMLElement;
  frames: { x: number; y: number }[];
  hazard: keyof typeof HAZARD_INFO;
  analytics: Analytics;
  stats: ReturnType<typeof createRunStats>;
  runLog: ReturnType<typeof createRunStats>['runLog'];
  fallLog: string[];
  ideal: ReturnType<typeof createIdealRun>;
  nav: ReturnType<typeof createNav>;
  botMode: boolean;
  zoneAt: (x: number) => ({ id: string; name: string } & Record<string, unknown>) | undefined;
  hardBand: () => { x0: number; x1: number; name: string; falls: number } | null;
  addHardest: (body: HTMLElement) => void;
  choice: () => 'a' | 'b';
  ghostCtl: () => Ghost | null;
  makeClip: MakeClip;
  restart: (x?: number) => void;
  onboarding: () => Pick<Onboarding, 'onCleared' | 'onFall'>;
}

// After a fall: retry at once, one tip, a skippable replay, and the offer to train that obstacle.
export function createFall(deps: FallDeps) {
  const { ctx, params, panel, diagBox, frames, hazard, analytics, stats, runLog, fallLog, ideal } = deps;
  const { course, st, log, specs } = ctx;
  const { enterZone, countsFor, summaries } = stats;
  const { saveResume, openEditor, trainLink } = deps.nav;
  const botMode = deps.botMode, zoneAt = deps.zoneAt, hardBand = deps.hardBand, addHardest = deps.addHardest;
  const wear = { choice: deps.choice };

  let lastFall: Fall = 'splash';
  function onFall(what: Fall) {
    const ghostCtl = deps.ghostCtl(), onboarding = deps.onboarding(), makeClip = deps.makeClip, restart = deps.restart;
    const watching = !!st.plan || !!st.demo || st.idealWhole; // owner 2026-11-04: an Ideal run (watched, not played) never counts in the play statistics, even when it ends in the water
    st.falls++; if (!watching) track('falls');
    lastFall = what;
    const r = st.world.runner;
    const zone = zoneAt(what === 'slide' && course.wall ? course.wall.x0 + 1 : r.x);
    st.lastZone = zone?.id ?? 'gap';
    if (!analytics.failed && !watching) {
      analytics.failed = true; trackCourseEvent('fail', analytics.courseKey, course.name, analytics.runId, analytics.mode, st.lastZone);
      const failedZone = zone?.id ?? st.lastZone;
      if (zone) fallLog.push(zone.id);
      enterZone(failedZone); countsFor(summaries[stats.kind], failedZone).failures++; stats.finishRun(false, analytics.runId);
    }
    st.retryX = ideal.cpFor(st.lastZone);
    const jump = [...log].reverse().find((e) => e.type === 'jump');
    let tip = 'Try again.', lateTip = false;
    if (what === 'slide') tip = OBSTACLES.wall.tips.slide;
    else if (what === 'hurt' && log.some((e) => e.type === 'ball-hit')) tip = 'The balls come at the same moments every time, for everyone. Wait for a gap between two balls, then go: too fast or too slow both meet the next one.';
    else if (what === 'hurt' && log.some((e) => e.type === 'drone-crash')) tip = OBSTACLES.drone.tips.crash;
    else if (what === 'hurt') tip = OBSTACLES.drop.tips.hurt;
    else if (course.track) tip = cartTip(ctx, what);
    else if (what === 'splash' && course.recoil && isAimable(recoilParams(course)) && zone?.id === 'recoil') tip = OBSTACLES.recoil.tips.aim;
    else if (course.drone && zone?.id === 'drone') tip = log.some((e) => e.type === 'drone-empty') ? OBSTACLES.drone.tips.empty : OBSTACLES.drone.tips.short;
    else if (course.recoil && zone?.id === 'recoil') tip = st.world.recoil && st.world.recoil.fired > 0 ? OBSTACLES.recoil.tips.push : OBSTACLES.recoil.tips.pad;
    else if (log.some((e) => e.type === 'plank-break')) tip = plankTip(ctx);
    else if (course.band) tip = bandTip(ctx);
    else if (zone?.id === 'trampoline') tip = OBSTACLES.trampoline.tips.fall;
    else if (zone?.id === 'rope') tip = OBSTACLES.rope.tips.fall;
    else if (!jump) tip = OBSTACLES.gap.tips.noJump;
    else if (jump && (jump.detail?.vx as number) !== undefined && (zone?.id === 'gap' || zone?.id === 'landing')) {
      const g = specs.find((q2) => r.x >= q2.x - 0.5 && r.x <= q2.x + q2.width + 1) ?? specs.find((q2) => q2.x >= r.x - 12);
      const v = jump.detail!.vx as number;
      tip = g && v < g.needed ? `You left the edge at ${v.toFixed(1)} m/s, but this ${g.width.toFixed(1)} m gap needs at least ${g.needed.toFixed(1)} m/s. Run longer before you jump.` : OBSTACLES.gap.tips.fast;
    } else {
      const ws = course.windows ?? ideal.windows(); // stored with the plan; otherwise asked of the workers below, never worked out on this thread
      const hit = ws && windowTip(ws, r.x);
      if (hit) tip = hit; else if (!ws) lateTip = true;
    }
    const train = ctx.everCleared || st.falls >= 3;
    panel.innerHTML = '';
    panel.style.display = 'grid';
    const h = document.createElement('h2'); h.style.cssText = 'margin:0;font:800 24px/1.25 system-ui,sans-serif;color:#17201d';
    h.textContent = what === 'slide' ? 'You slid back down the wall.' : what === 'hurt' ? (log.some((e) => e.type === 'ball-hit') ? `A ball hit you at the ${zone?.name ?? 'course'}.` : `Hard landing at the ${zone?.name ?? 'course'}.`) : what === 'stall' ? 'The cart ran out of speed on a hill.' : log.some((e) => e.type === 'plank-break') ? 'The plank broke under you.' : log.some((e) => e.type === 'cart-off') ? 'The cart left the track at a hilltop.' : HAZARD_INFO[hazard].headline(zone?.name ?? 'course');
    const t = document.createElement('p'); t.style.cssText = 'margin:0;font-size:17px;line-height:1.45;color:#17201d'; t.textContent = tip;
    if (lateTip) void ideal.ensureWindows().then((ws) => { const hit = ws && windowTip(ws, r.x); if (hit && t.isConnected) t.textContent = hit; });
    const floorNote = document.createElement('div'); floorNote.style.cssText = 'margin:-4px 0 0;color:#58635d;font-size:14px'; floorNote.textContent = what === 'slide' || what === 'hurt' ? '' : HAZARD_INFO[hazard].hint;
    // CC-133: three tiers, no boxes. One big primary (try again), a row of learning actions, and a quiet row of share and tools.
    const actions = document.createElement('div'); actions.id = 'fall-actions'; actions.style.cssText = 'display:grid;gap:12px;margin:4px 0';
    const mkRow = (id: string, css: string) => { const r2 = document.createElement('div'); r2.id = id; r2.style.cssText = css; actions.appendChild(r2); return r2; };
    const prim = mkRow('fall-primary', 'display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center');
    const learn = mkRow('fall-learn', 'display:flex;flex-wrap:wrap;gap:8px');
    const tools = mkRow('fall-tools', 'display:flex;flex-wrap:wrap;gap:2px 14px;align-items:center;padding-top:8px;border-top:1px solid #e5e9e5');
    const TIER = {
      primary: 'font:800 20px system-ui,sans-serif;border:0;background:#0f6b5c;color:#fff;border-radius:10px;padding:14px 32px;cursor:pointer;box-shadow:0 2px 6px #0f6b5c55',
      learn: 'font:600 15px system-ui,sans-serif;border:0;background:#e9f5f1;color:#0f6b5c;border-radius:8px;padding:9px 16px;cursor:pointer',
      quiet: 'font:400 13px system-ui,sans-serif;border:0;background:none;color:#58635d;text-decoration:underline;padding:4px 0;cursor:pointer',
    };
    const mk = (label: string, fn: () => void, tier: keyof typeof TIER = 'learn', into?: HTMLElement) => {
      const b = document.createElement('button');
      b.textContent = label; b.style.cssText = TIER[tier];
      b.onclick = fn; (into ?? (tier === 'primary' ? prim : tier === 'learn' ? learn : tools)).appendChild(b); return b;
    };
    const retry = mk(`Try this ${zone?.name ?? 'obstacle'} again (R)`, () => restart(st.retryX), 'primary');
    if (st.retryX !== course.startX) mk('Start from the beginning (Shift+R)', () => { st.retryX = course.startX; restart(course.startX); }, 'quiet', prim);
    mk('Watch what happened, with the numbers', () => {
      panel.style.display = 'none';
      const from = Math.max(0, frames.length - 300);
      st.replay = { i: from, from, to: frames.length };
      const lines = course.track ? cartDiag(ctx) : buildDiag(ctx, st.lastZone, what === 'slide' ? 'slide' : 'splash');
      diagBox.innerHTML = `<strong>Slow-motion replay</strong><ul style="margin:6px 0 0;padding-left:18px">${lines.map((l) => `<li>${l}</li>`).join('')}</ul><div style="color:#58635d;font-size:13px;margin-top:6px">Esc to skip</div>`;
      diagBox.style.display = 'block';
    });
    const tryClip = shareOn(params) && !botMode && !st.demo && !st.idealWhole && !params.get('mode') ? ghostCtl?.myClip() ?? null : null, tryTicks = st.world.runner.tick;
    const tryFrom = tryClip ? startOfX(course, tryClip.from) : null; // CC-242: a try from a checkpoint is shared with its start, so the friend begins at the same place
    const tryStart = tryFrom ?? 0;
    const tryRun = shareOn(params) && !botMode && !st.demo && !st.idealWhole && !params.get('mode') ? (ghostCtl?.myRun() ?? (tryFrom ? tryClip?.log ?? null : null)) : null; // CC-181: a try that fell can be sent as a link too; it never counts for a time
    mk('Show me the ideal run (I)', () => ideal.showIdeal(st.lastZone));
    if (train) mk(`Train the ${zone?.name ?? 'obstacle'}`, () => { saveResume(); location.search = trainLink(zone?.id ?? 'gap', r.x); });
    if (!course.track) mk('Make it easier', () => openEditor('easier')).id = 'makeeasier';
    if (tryRun) tools.append(...copyLinkButton({ link: (nick) => makeLinkInfo(location.origin, pageSearch(), course, tryRun, nick, wear.choice(), 'fell', undefined, tryStart), courseTooBig: () => courseTooBig(pageSearch(), course), label: 'Copy link to this try', id: 'share-copy-fall' }).map((el) => { if (el instanceof HTMLButtonElement) el.style.cssText = TIER.quiet; return el; }));
    if (tryClip && clipFits(tryTicks)) mk('Download a video of this try', () => void makeClip(tryClip.log, tryTicks, tryClip.from), 'quiet').id = 'share-clip-fall'; // CC-157: a try that ended in a fall is worth a clip too
    mk('Edit this course', () => openEditor('edit'), 'quiet').id = 'editfromfall';
    const failBody = renderReport(course, runLog, buildReport(course, runLog, st.world, false, null), {}, true, ghostCtl?.reportPath() ?? null, !reportSectionsOn(params), hardBand());
    addHardest(failBody);
    const metres = failBody.firstElementChild as HTMLElement | null; if (metres) metres.style.cssText = 'font:700 15px system-ui,sans-serif;color:#0f6b5c'; // the one key number: how far you got
    panel.append(h, ...(metres ? [metres] : []), t, floorNote, actions, failBody);
    if (st.falls === 1 && !st.idealWhole) onboarding.onFall(panel); // CC-100: the first fall gets one calm hint (CC-191: inside the report, not over it)
    retry.focus({ preventScroll: true }); panel.scrollTop = 0;
  }

  function showAgain() { st.falls--; onFall(lastFall); }
  return { onFall, showAgain };
}
