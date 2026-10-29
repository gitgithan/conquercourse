import { customLane, provedLane, quickLane, stripRows, type LaneSummary, type StripRow } from './slicer-core';
import type { MapPiece } from './slicer';

// Cuts the lane for one cut height off the page's thread (the Slicer, CC-73). Two answers: the best lane by its shape at once,
// then, when the simulator has tried to clear it, the best lane it can clear (or none).
// CC-92: a lane carries its facts (widest gap, tallest step, fall) so the page can say why it cannot be cleared, and a "strip" ask
// looks at many heights at once (shape only, no simulator proof) so the slider can show where a lane looks crossable.
export interface SliceAsk { id: number; positions: number[]; indices: number[]; pieces?: MapPiece[]; level: number; strip?: number[]; custom?: { angle: number; offset: number } } // custom: the player's own line (CC-93), the turn and the sideways step in the shrunk place
export type { LaneSummary };
export type { StripRow };
export type SliceAnswer = { id: number; phase: 'quick' | 'proved'; lane: LaneSummary | null } | { id: number; phase: 'strip'; rows: StripRow[] };

const ctx = self as unknown as { onmessage: ((e: { data: SliceAsk }) => void) | null; postMessage(m: SliceAnswer): void };

ctx.onmessage = (e) => {
  const { id, positions, indices, pieces, level, strip, custom } = e.data;
  if (strip) { ctx.postMessage({ id, phase: 'strip', rows: stripRows({ positions, indices }, strip) }); return; }
  const mesh = { positions, indices };
  // CC-179: the check reads the lane from the pieces the editor will get (when the page sends them), so the preview and the built course agree
  const place = { mesh, pieces: pieces ?? [] };
  if (custom) { // the player's own line: read it the way the editor will, say what is on it, and try to clear it
    const r = customLane(place, { angle: custom.angle, offset: custom.offset, level });
    ctx.postMessage({ id, phase: 'quick', lane: r.quick });
    ctx.postMessage({ id, phase: 'proved', lane: r.proved });
    return;
  }
  const quick = quickLane(place, level);
  ctx.postMessage({ id, phase: 'quick', lane: quick });
  if (!quick) { ctx.postMessage({ id, phase: 'proved', lane: null }); return; }
  ctx.postMessage({ id, phase: 'proved', lane: provedLane(place, level) });
};
