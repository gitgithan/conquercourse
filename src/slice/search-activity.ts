import type { LaneProgress } from './lane-check';

// Worker batches describe the obstacle being tested, not a time estimate or a finished proof.
export function searchActivity(p: LaneProgress | null, preview = false) {
  const at = p ? /(?:edge|step) at (-?[\d.]+) m/.exec(p.label) : null;
  const x = at && Number.isFinite(Number(at[1])) ? Number(at[1]) : null;
  if (!p) return { stage: `Trying movement timings to find a complete run through ${preview ? 'these edits' : 'this lane'}.`, fraction: null, x };
  if (p.label === 'the whole course') return { stage: `Replaying a complete run through ${preview ? 'the proposed course' : 'this lane'}.`, fraction: null, x: null };
  const place = x === null ? '' : ` at ${x} m`;
  const task = p.label.includes('monkey bars') ? `Trying bar swing and reach timings${place}`
    : p.label.includes('trebuchet') ? 'Trying trebuchet release timings'
    : p.label.includes('step at') ? `Trying vault and climb timings${place}`
    : p.label.includes('edge at') ? `Trying jump and grab timings${place}` : `Testing ${p.label}`;
  const total = Number.isFinite(p.of) ? Math.max(0, Math.floor(p.of)) : 0;
  const step = Number.isFinite(p.step) ? Math.min(total, Math.max(0, Math.floor(p.step))) : 0;
  return {
    stage: total ? `Obstacle ${Math.min(total, step + 1)} of ${total}: ${task}.` : `${task}.`,
    fraction: total && step > 0 ? Math.min(0.95, step / total) : null,
    x,
  };
}
