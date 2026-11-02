import { describe, expect, it } from 'vitest';
import { createEditorState, isDevice, isSizeReference, laneOf } from '../src/modes/editor/state';
import { createLane } from '../src/modes/editor/lane';
import { DEFAULT_WATER_LEVEL } from '../src/slice/editor-defaults';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';

// The shared state of the World editor and what is derived from it; no page is needed.
describe('editor state', () => {
  it('starts empty, on water, with the default level and no start-deck device', () => {
    const ed = createEditorState();
    expect(ed.pieces).toEqual([]); expect(ed.selected).toBeNull(); expect(ed.group).toEqual([]);
    expect(ed.level).toBe(DEFAULT_WATER_LEVEL); expect(ed.floorChoice).toBe('water');
    expect(ed.bandK).toBeNull(); expect(ed.trebuchetKg).toBeNull(); expect(ed.recoilCfg).toBeNull(); expect(ed.droneCfg).toBeNull();
  });
  it('two states never share a list', () => {
    const a = createEditorState(), b = createEditorState();
    a.pieces.push(newPiece('x', box(1, 1, 1), { x: 0, z: 0 }));
    expect(b.pieces).toHaveLength(0); expect(a.view).not.toBe(b.view); expect(a.designed).not.toBe(b.designed);
  });
  it('laneOf reads the three lane numbers', () => {
    const ed = createEditorState(); ed.angle = 0.5; ed.offset = 2;
    expect(laneOf(ed)).toEqual({ angle: 0.5, offset: 2, level: ed.level });
  });
  it('devices and size references are told apart by their source', () => {
    const p = (src: string) => ({ ...newPiece('p', box(1, 1, 1), { x: 0, z: 0 }), src });
    expect(isDevice(p('device:trebuchet:1200'))).toBe(true); expect(isDevice(p('hold:bar'))).toBe(false);
    expect(isSizeReference(p('obj:../characters/rookie-a.glb'))).toBe(true); expect(isSizeReference(p('hold:bar'))).toBe(false);
  });
});

describe('editor lane derivations', () => {
  const add = (ed: ReturnType<typeof createEditorState>, src: string, x: number) => { const q = { ...newPiece('p', box(2, 1, 2), { x, z: 0 }), src }; ed.pieces.push(q); return q; };
  it('course pieces leave out devices and size references', () => {
    const ed = createEditorState(), lane = createLane(ed);
    add(ed, 'device:drone:70:50:3', 0); add(ed, 'obj:../characters/rookie-b.glb', 1); const g = add(ed, 'shape:box', 5);
    expect(lane.coursePieces()).toEqual([g]);
  });
  it('finds the device pieces by their source', () => {
    const ed = createEditorState(), lane = createLane(ed);
    expect(lane.dronePiece()).toBeUndefined(); expect(lane.recoilPiece()).toBeUndefined();
    const d = add(ed, 'device:drone:70:50:3', 0), r = add(ed, 'device:cannon:12:30:2.5', 4);
    expect(lane.dronePiece()).toBe(d); expect(lane.recoilPiece()).toBe(r);
  });
  it('updateDeviceSource rewrites the source of the device with that prefix', () => {
    const ed = createEditorState(), lane = createLane(ed);
    const d = add(ed, 'device:drone:70:50:3', 0);
    lane.updateDeviceSource('device:drone', 'device:drone:90:100:3');
    expect(d.src).toBe('device:drone:90:100:3');
  });
  it('the machine is the trebuchet counterweight, or none', () => {
    const ed = createEditorState(), lane = createLane(ed);
    expect(lane.machineNow()).toBeNull();
    ed.trebuchetKg = 1500; expect(lane.machineNow()?.counterweight).toBe(1500);
  });
});
