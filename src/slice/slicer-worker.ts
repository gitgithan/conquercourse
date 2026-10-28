import { bestSlices, surfaceSamples, type Candidate } from './slice';

// Cuts the lane for one cut height off the page's thread (the Slicer, CC-73). Two answers: the best lane by its shape at once,
// then, when the simulator has tried to clear it, the best lane it can clear (or none).
export interface SliceAsk { id: number; positions: number[]; indices: number[]; level: number }
export interface LaneSummary { angle: number; offset: number; origin: number; length: number; score: number }
export interface SliceAnswer { id: number; phase: 'quick' | 'proved'; lane: LaneSummary | null }

const ctx = self as unknown as { onmessage: ((e: { data: SliceAsk }) => void) | null; postMessage(m: SliceAnswer): void };
const summary = (c: Candidate): LaneSummary => ({ angle: c.angle, offset: c.offset, origin: c.profile.origin ?? 0, length: c.profile.length, score: c.report.score });

ctx.onmessage = (e) => {
  const { id, positions, indices, level } = e.data;
  const samples = surfaceSamples({ positions, indices }, 80); // lighter than the default: a district is big
  const opts = { levels: [level], top: 1, centre: { x: 0, z: 0 } };
  const quick = bestSlices({ positions: samples }, { ...opts, prove: false });
  ctx.postMessage({ id, phase: 'quick', lane: quick[0] ? summary(quick[0]) : null });
  if (!quick[0]) { ctx.postMessage({ id, phase: 'proved', lane: null }); return; }
  const proved = bestSlices({ positions: samples }, { ...opts, maxProofs: 4 });
  ctx.postMessage({ id, phase: 'proved', lane: proved[0] ? summary(proved[0]) : null });
};
