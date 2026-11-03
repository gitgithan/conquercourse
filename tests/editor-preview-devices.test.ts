import { describe, expect, it } from 'vitest';
import { createLane } from '../src/modes/editor/lane';
import { createEditorState } from '../src/modes/editor/state';
import { newPiece } from '../src/slice/world';
import { deviceMesh } from '../src/slice/device';
import { searchInput } from '../src/slice/preset-plans';
import { box } from '../src/slice/shapes';

describe('preview checks exactly the devices currently in the editor', () => {
  for (const src of [undefined, 'device:trebuchet:1500', 'device:drone:95:120:3', 'device:cannon:18:42:2', 'device:bigcannon:80:45:4', 'band']) {
    it(`builds the same course for preview and Play with ${src ?? 'no device'}`, () => {
      const ed = createEditorState(); ed.angle = 0.4; ed.offset = 2;
      ed.pieces = [newPiece('Roof', box(30, 1, 20), { x: 15, z: 3 })];
      if (src === 'band') ed.bandK = 85;
      else if (src) ed.pieces.push({ ...newPiece('Device', deviceMesh(src), { x: 2, z: 1 }), src });
      if (src?.startsWith('device:trebuchet')) { ed.trebuchetKg = 1500; ed.trebuchetExtra = { short: 1.3, pin: 42 }; }
      const lane = createLane(ed), setting = { angle: ed.angle, offset: ed.offset, level: ed.level };
      const preview = lane.courseFor(ed.pieces.map((p) => ({ ...p })), setting, lane.machineNow());
      expect(searchInput(preview)).toEqual(searchInput(lane.courseNow()));
      expect(preview.trebuchet != null).toBe(src?.startsWith('device:trebuchet') ?? false);
      expect(preview.drone != null).toBe(src?.startsWith('device:drone') ?? false);
      expect(preview.recoil != null).toBe(src?.startsWith('device:cannon') || src?.startsWith('device:bigcannon') || false);
      expect(preview.band != null).toBe(src === 'band');
      expect(lane.profileFor(ed.pieces, setting)).toEqual(lane.currentProfile());
      if (src?.startsWith('device:drone')) expect(preview.drone).toMatchObject({ payload: 95, battery: 120 });
      if (src?.startsWith('device:trebuchet')) expect(preview.trebuchet).toMatchObject({ counterweight: 1500, short: 1.3, pin: 42 });
    });
  }
  it('uses the proposed device position and machine settings without mutating the current editor', () => {
    const ed = createEditorState();
    ed.pieces = [newPiece('Roof', box(20, 1, 3)), { ...newPiece('Trebuchet', deviceMesh('device:trebuchet:1500')), src: 'device:trebuchet:1500' }];
    ed.trebuchetKg = 1500;
    const lane = createLane(ed), original = lane.courseNow();
    const pieces = ed.pieces.map((p) => ({ ...p, x: p.src ? p.x + 4 : p.x }));
    const preview = lane.courseFor(pieces, ed, { counterweight: 1800, pin: 30 });
    expect(preview.trebuchet?.x).toBeCloseTo(original.trebuchet!.x + 4);
    expect(preview.trebuchet?.counterweight).toBe(1800);
    expect(lane.courseNow()).toEqual(original);
  });
});
