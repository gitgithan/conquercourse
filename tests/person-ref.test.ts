import { describe, expect, it } from 'vitest';
import { box } from '../src/slice/shapes';
import { PERSON_GAP, PERSON_SIDE, personStart } from '../src/slice/person-ref';
import { newPiece } from '../src/slice/world';

describe('where the person for scale stands (CC-96)', () => {
  it('beside the origin when the world is empty', () => { const at = personStart([], { angle: 0, offset: 0 }); expect(at.x).toBeCloseTo(0, 6); expect(at.z).toBeCloseTo(PERSON_SIDE, 6); });
  it('a little before the first piece along the lane', () => {
    const a = newPiece('A', box(2, 1, 1), { x: 10, z: 0 }), b = newPiece('B', box(2, 1, 1), { x: 20, z: 0 });
    const at = personStart([b, a], { angle: 0, offset: 0 });
    expect(at.x).toBeCloseTo(10 - 1 - PERSON_GAP, 6);
    expect(at.z).toBeCloseTo(PERSON_SIDE, 6);
  });
  it('stays in the lane when the lane is turned and shifted', () => {
    const a = newPiece('A', box(2, 1, 1), { x: 0, z: 10 });
    const at = personStart([a], { angle: Math.PI / 2, offset: 1 });
    expect(at.z).toBeCloseTo(10 - 1 - PERSON_GAP, 6);
    expect(at.x).toBeCloseTo(-(1 + PERSON_SIDE), 6);
  });
  it('ignores the person already standing there', () => {
    const p = { ...newPiece('Person', box(0.5, 1.75, 0.3), { x: -50, z: 0 }), src: 'obj:../characters/rookie-a.glb' };
    const a = newPiece('A', box(2, 1, 1), { x: 10, z: 0 });
    expect(personStart([p, a], { angle: 0, offset: 0 }).x).toBeCloseTo(10 - 1 - PERSON_GAP, 6);
  });
});
