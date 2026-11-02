import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WATER_LEVEL, START_LABEL, levelOfSaved, partnerStartsOpen, startMarkSide } from '../src/slice/editor-defaults';
import { editorSource } from './helpers/editor-source';
import { PRESETS } from '../src/slice/presets';

describe('World Editor defaults (CC-200)', () => {
  it('the Design partner starts hidden unless the player opened it by hand last time', () => {
    expect(partnerStartsOpen(null)).toBe(false);
    expect(partnerStartsOpen('0')).toBe(false);
    expect(partnerStartsOpen('1')).toBe(true);
  });
  it('a new world has the water at 0 and so does every ready-made course', () => {
    expect(DEFAULT_WATER_LEVEL).toBe(0);
    expect(levelOfSaved(null)).toBe(0);
    expect(levelOfSaved({})).toBe(0);
    expect(levelOfSaved({ level: Number.NaN })).toBe(0);
    for (const p of PRESETS) expect((p as unknown as { level?: number }).level ?? 0).toBe(0);
  });
  it('an old saved world keeps its own level', () => {
    expect(levelOfSaved({ level: 1.25 })).toBe(1.25);
    expect(levelOfSaved({ level: 0 })).toBe(0);
  });
  it('the editor reads the default and the saved level through these helpers', () => {
    const src = editorSource();
    expect(src).toMatch(/level(: | = )DEFAULT_WATER_LEVEL/);
    expect(src).toContain('level = levelOfSaved(s)');
    expect(src).toContain('partnerStartsOpen(');
  });
});

describe('the Start marker (CC-200)', () => {
  it('says in plain words where the runner begins, and is not the person-for-scale label', () => {
    expect(START_LABEL).toMatch(/^Start/);
    expect(START_LABEL).not.toMatch(/person/i);
  });
  it('the side view puts the flag on the first ground of the lane', () => {
    expect(startMarkSide({ cells: [], origin: 0 }, 0.1)).toBeNull();
    expect(startMarkSide({ cells: [null, null, 0.5, 0.5], origin: 2 }, 0.1)).toEqual({ u: 2.2, h: 0.5 });
  });
  it('the 3D view and the side view both draw it', () => {
    expect(readFileSync('src/slice/view3d.ts', 'utf8')).toContain('START_LABEL');
    expect(editorSource()).toContain('startMarkSide(prof');
  });
});
