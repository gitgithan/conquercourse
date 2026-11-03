import { describe, expect, it } from 'vitest';
import { createHistory } from '../src/modes/editor/history';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';

// Undo and redo of the World editor, driven with a fake editor state.
function rig() {
  const mesh = box(1, 1, 1);
  const st = { pieces: [newPiece('a', mesh, { x: 0, z: 0 })], lane: { angle: 0, offset: 0, level: 0 } as { angle: number; offset: number; level: number; start?: { x: number; z: number; y: number } }, selected: null as number | null, changed: [] as (boolean | undefined)[] };
  const undo = { disabled: true } as HTMLButtonElement, redo = { disabled: true } as HTMLButtonElement;
  const h = createHistory({
    getPieces: () => st.pieces as never, setPieces: (v) => { st.pieces = v as never; }, getLane: () => st.lane, setLane: (v) => { st.lane = v; },
    getSelected: () => st.selected, setSelected: (v) => { st.selected = v; }, undoBtn: () => undo, redoBtn: () => redo, changed: (r) => { st.changed.push(r); },
  });
  return { st, h, undo, redo };
}

describe('editor undo history', () => {
  it('the first snapshot starts the list with both buttons off', () => {
    const r = rig(); r.h.remember();
    expect(r.h.hi).toBe(0); expect(r.undo.disabled).toBe(true); expect(r.redo.disabled).toBe(true);
  });
  it('a repeat of the same world adds nothing', () => {
    const r = rig(); r.h.remember(); r.h.remember();
    expect(r.h.hist).toHaveLength(1);
  });
  it('a change adds a step, undo goes back and redo comes forward', () => {
    const r = rig(); r.h.remember();
    r.st.pieces[0].x = 4; r.h.remember();
    expect(r.h.hi).toBe(1); expect(r.undo.disabled).toBe(false);
    r.h.goto(0);
    expect(r.st.pieces[0].x).toBe(0); expect(r.undo.disabled).toBe(true); expect(r.redo.disabled).toBe(false); expect(r.st.changed).toEqual([false]);
    r.h.goto(1);
    expect(r.st.pieces[0].x).toBe(4); expect(r.redo.disabled).toBe(true);
  });
  it('a new change after undo drops the redo steps', () => {
    const r = rig(); r.h.remember();
    r.st.pieces[0].x = 4; r.h.remember(); r.h.goto(0);
    r.st.pieces[0].x = 7; r.h.remember();
    expect(r.h.hist.map((s) => s.pieces[0].x)).toEqual([0, 7]);
  });
  it('the lane comes back with the pieces and a gone selection is cleared', () => {
    const r = rig(); r.h.remember();
    r.st.lane = { angle: 1, offset: 2, level: 3, start: undefined }; r.st.selected = 12345; r.h.remember();
    r.h.goto(0);
    expect(r.st.lane).toEqual({ angle: 0, offset: 0, level: 0 }); expect(r.st.selected).toBeNull();
  });
  it('undo and redo restore the fixed pivot without sharing a mutable point', () => {
    const r = rig(); r.h.remember();
    r.st.lane.start = { x: 12, z: 4, y: 2 }; r.h.remember();
    r.st.lane.start.x = 20;
    r.h.goto(0); expect(r.st.lane.start).toBeUndefined();
    r.h.goto(1); expect(r.st.lane.start).toEqual({ x: 12, z: 4, y: 2 });
    r.st.lane.start!.x = 30;
    expect(r.h.hist[1].start?.x).toBe(12);
  });
  it('goto outside the list does nothing; the list keeps at most 80 steps', () => {
    const r = rig(); r.h.remember(); r.h.goto(5);
    expect(r.h.hi).toBe(0);
    for (let i = 1; i <= 90; i++) { r.st.pieces[0].x = i; r.h.remember(); }
    expect(r.h.hist).toHaveLength(80); expect(r.h.hi).toBe(79);
  });
});
