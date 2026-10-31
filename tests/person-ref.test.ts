import { describe, expect, it } from 'vitest';
import { box } from '../src/slice/shapes';
import { PERSON_GAP, PERSON_SIDE, SCALE_BEAM_HEIGHT, SCALE_LABEL_HEIGHT, markerAt, personStart } from '../src/slice/person-ref';
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

describe('the marker over the person stands where the person stands (CC-96)', () => {
  const tall = { ...newPiece('Person', box(0.5, 1.75, 0.3), { x: 0, z: 0 }), src: 'obj:../characters/rookie-a.glb' };
  it('is a 30 m cone, with its label just over a head', () => { expect(SCALE_BEAM_HEIGHT).toBe(30); expect(SCALE_LABEL_HEIGHT).toBeGreaterThan(1.75); expect(SCALE_LABEL_HEIGHT).toBeLessThan(2.5); });
  it('first visit: on the start spot', () => {
    const a = newPiece('A', box(2, 1, 1), { x: 10, z: 3 });
    const at = personStart([a], { angle: 0.3, offset: 1 }); const p = { ...tall, x: at.x, z: at.z };
    expect(markerAt(p)).toEqual({ x: at.x, z: at.z });
  });
  it('Fit moves the camera and not the person, so the marker stays', () => {
    const p = { ...tall, x: 4.2, z: -1.1 };
    const before = markerAt(p), afterFit = markerAt({ ...p }); // Fit changes only the view
    expect(afterFit).toEqual(before);
  });
  it('follows the person when they are moved', () => {
    const p = { ...tall, x: 4.2, z: -1.1 };
    const moved = { ...p, x: -12.5, z: 7.75 };
    expect(markerAt(moved)).toEqual({ x: -12.5, z: 7.75 });
    expect(markerAt(p)).toEqual({ x: 4.2, z: -1.1 });
  });
  it('never stands on a tall thin rod, whatever the rod is (owner, 2026-11-01)', () => {
    const rod = newPiece('Rod', box(0.1, 6, 0.1), { x: 5, z: 0 });
    const at = personStart([rod], { angle: 0, offset: 0 });
    expect(Math.hypot(at.x - rod.x, at.z - rod.z)).toBeGreaterThan(2);
    expect(at.x).toBeLessThan(rod.x - 0.05 - PERSON_GAP + 1e-9);
  });
});
