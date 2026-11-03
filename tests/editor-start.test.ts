import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { editorStart, shiftLane, turnLane } from '../src/modes/editor/start';
import { roofStartOn, setRoofStart } from '../src/slice/slice';
import { createEditorState } from '../src/modes/editor/state';

const profile = { origin: 12, length: 20, cells: [null, 2, 2, 2] };

describe('turning the lane about its visible start', () => {
  const wasRoof = roofStartOn();
  beforeEach(() => setRoofStart(true));
  afterEach(() => setRoofStart(wasRoof));
  it('keeps a nonzero start fixed through repeated turns even when the new cut starts elsewhere', () => {
    const ed = createEditorState(); ed.offset = 4;
    const start = editorStart(ed, profile);
    for (const angle of [15, 45, 90, 135, 180, 0]) {
      turnLane(ed, angle * Math.PI / 180, profile);
      const at = editorStart(ed, { origin: -40, length: 1, cells: [9] });
      expect(at.x).toBeCloseTo(start.x, 9); expect(at.z).toBeCloseTo(start.z, 9); expect(at.y).toBe(start.y);
      expect(-start.x * Math.sin(ed.angle) + start.z * Math.cos(ed.angle)).toBeCloseTo(ed.offset, 9);
    }
  });
  it('keeps the pivot after saving and loading, regardless of the newly sampled first roof', () => {
    const ed = createEditorState(); turnLane(ed, Math.PI / 3, profile);
    const saved = JSON.parse(JSON.stringify(ed));
    expect(editorStart(saved, { origin: -30, length: 1, cells: [8] })).toEqual(editorStart(ed, profile));
  });
  it('moves the start with the sideways control, then turns around the new point', () => {
    const ed = createEditorState(); turnLane(ed, Math.PI / 2, profile);
    const before = editorStart(ed, profile);
    shiftLane(ed, ed.offset + 3);
    const after = editorStart(ed, profile);
    expect(after.x).toBeCloseTo(before.x - 3); expect(after.z).toBeCloseTo(before.z);
    turnLane(ed, Math.PI, profile);
    expect(editorStart(ed, profile).x).toBeCloseTo(after.x);
    expect(editorStart(ed, profile).z).toBeCloseTo(after.z);
  });
});
