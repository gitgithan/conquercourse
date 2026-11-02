// The numbers behind the run report and the analytics: which obstacles were entered, cleared and fallen at, how far the run got, how hard the landings were and how smooth the movement was.
// One object made once in startCourse; the frame loop feeds it and the fall and clear code close the run through it.
import { DT } from '../../sim/units';
import { noteRun } from '../../ui/feedback-model';
import { clearLog, newLog } from '../../ui/run-report';
import type { CourseCtx } from './context';

export type RunKind = 'attempt' | 'practice';
export type ObstacleCounts = { attempts: number; successes: number; failures: number };
export type RunSummary = { runs: number; failures: number; completions: number; ticks: number; progressSum: number; progressCount: number; landings: number; landingOuch: number; bentLandings: number; obstacles: Record<string, ObstacleCounts> };

export function createRunStats(ctx: CourseCtx, firstKind: RunKind) {
  const { course, st } = ctx;
  const summary = (): RunSummary => ({ runs: 0, failures: 0, completions: 0, ticks: 0, progressSum: 0, progressCount: 0, landings: 0, landingOuch: 0, bentLandings: 0, obstacles: {} });
  const summaries: Record<RunKind, RunSummary> = { attempt: summary(), practice: summary() };
  let runKind: RunKind = firstKind;
  const runLog = newLog(); // the path and the moves of this run, for the report (src/ui/run-report.ts)
  let runStartX = st.world.runner.x, runFurthestX = st.world.runner.x, runFailures = 0, runLandingOuch = 0, runLandings = 0, runBentLandings = 0;
  let flowSampleTick = st.world.runner.tick, flowSampleVx = st.world.runner.vx, flowSampleVy = st.world.runner.vy;
  let flowAccelX: number | null = null, flowAccelY: number | null = null, runJerkSum = 0, runJerkSamples = 0;
  let attemptEnded = false;
  const enteredZones = new Set<string>(), clearedZones = new Set<string>();
  let previousRunX = st.world.runner.x;
  const zones = course.zones?.length ? course.zones : [{ id: 'course', name: course.name, x0: course.startX, x1: course.finishX }];
  const countsFor = (bucket: RunSummary, zoneId: string): ObstacleCounts => bucket.obstacles[zoneId] ?? (bucket.obstacles[zoneId] = { attempts: 0, successes: 0, failures: 0 });
  const enterZone = (zoneId: string) => {
    if (enteredZones.has(zoneId)) return;
    enteredZones.add(zoneId); countsFor(summaries[runKind], zoneId).attempts++;
  };
  function updateRunProgress(x: number) {
    runFurthestX = Math.max(runFurthestX, x);
    for (const z of zones) {
      if (x >= z.x0 && x < z.x1) enterZone(z.id);
      if (x >= z.x1 && previousRunX < z.x1 && x >= z.x0 && !clearedZones.has(z.id)) { enterZone(z.id); clearedZones.add(z.id); countsFor(summaries[runKind], z.id).successes++; }
    }
    previousRunX = x;
  }
  function updateFlow(tick: number, vx: number, vy: number) {
    if (tick - flowSampleTick < 12) return; // sample at 10 Hz to measure movement changes, not individual simulator ticks
    const seconds = (tick - flowSampleTick) * DT;
    const ax = (vx - flowSampleVx) / seconds, ay = (vy - flowSampleVy) / seconds;
    if (flowAccelX !== null && flowAccelY !== null) {
      runJerkSum += Math.hypot(ax - flowAccelX, ay - flowAccelY) / seconds;
      runJerkSamples++;
    }
    flowSampleTick = tick; flowSampleVx = vx; flowSampleVy = vy; flowAccelX = ax; flowAccelY = ay;
  }
  function resetFlowSample() {
    flowSampleTick = st.world.runner.tick; flowSampleVx = st.world.runner.vx; flowSampleVy = st.world.runner.vy;
    flowAccelX = null; flowAccelY = null; runJerkSum = 0; runJerkSamples = 0;
  }
  function clearFinishZone(x: number) {
    const z = zones.find((zone) => x >= zone.x0 && x <= zone.x1);
    if (z && !clearedZones.has(z.id)) { enterZone(z.id); clearedZones.add(z.id); countsFor(summaries[runKind], z.id).successes++; }
  }
  function finishRun(success: boolean, runId: string) {
    if (attemptEnded) return;
    attemptEnded = true;
    noteRun({ lastRun: `${success ? 'Cleared' : 'Fell'} at ${(st.world.runner.tick * DT).toFixed(1)} s`, replay: runId.slice(0, 8) });
    const bucket = summaries[runKind];
    bucket.ticks += st.world.runner.tick;
    bucket.progressSum += Math.max(0, Math.min(100, (runFurthestX - runStartX) / Math.max(1, course.finishX - runStartX) * 100)); bucket.progressCount++;
    if (success) bucket.completions++;
    else { bucket.failures++; runFailures++; }
  }
  // a landing the run report and the summary both count (o is how much it hurt, bent is a landing with bent knees)
  function noteLanding(o: number, bent: boolean) {
    runLandings++; runLandingOuch += o;
    const bucket = summaries[runKind]; bucket.landings++; bucket.landingOuch += o;
    if (bent) { runBentLandings++; bucket.bentLandings++; }
  }
  const resetRunStats = (x: number) => {
    runKind = x > course.startX + 0.01 ? 'practice' : 'attempt';
    summaries[runKind].runs++;
    runStartX = x; runFurthestX = x; runFailures = 0; runLandingOuch = 0; runLandings = 0; runBentLandings = 0; previousRunX = x; resetFlowSample();
    attemptEnded = false; enteredZones.clear(); clearedZones.clear(); clearLog(runLog);
  };
  summaries[runKind].runs++;
  updateRunProgress(st.world.runner.x);
  return { runLog, summaries, countsFor, enterZone, updateRunProgress, updateFlow, clearFinishZone, finishRun, noteLanding, resetRunStats, get kind() { return runKind; } };
}
