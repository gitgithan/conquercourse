import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitDistance, pieceBounds, type ViewBounds } from '../src/slice/view-fit';
import { box } from '../src/slice/shapes';
import { newPiece } from '../src/slice/world';

describe('editor camera fit', () => {
  it('uses the narrow footprint of a long piece, including its turn, scale and elevation', () => {
    const piece = { ...newPiece('Long roof', box(30, 2, 3), { x: 20, z: 4 }), y: 5, scale: 2, yaw: Math.PI / 2 };
    const b = pieceBounds([piece]);
    expect(b.x0).toBeCloseTo(17); expect(b.x1).toBeCloseTo(23);
    expect(b.z0).toBeCloseTo(-26); expect(b.z1).toBeCloseTo(34);
    expect(b.bottom).toBe(5); expect(b.top).toBe(9);
  });
  for (const [name, b] of Object.entries({
    long: { x0: -30, x1: 30, z0: -2, z1: 2, bottom: 0, top: 3 },
    tall: { x0: -2, x1: 2, z0: -3, z1: 3, bottom: 5, top: 40 },
    flat: { x0: -20, x1: 20, z0: -20, z1: 20, bottom: 0, top: 0 },
  } satisfies Record<string, ViewBounds>)) {
    it(`fits every corner of a ${name} world closely at different view angles and aspect ratios`, () => {
      for (const aspect of [0.9, 2]) for (const direction of [new Vector3(0, 1, 2), new Vector3(2, 1, 1), new Vector3(-1, 3, 1)]) {
        const camera = new PerspectiveCamera(45, aspect, 0.1, 600);
        const centre = new Vector3((b.x0 + b.x1) / 2, (b.bottom + b.top) / 2, (b.z0 + b.z1) / 2);
        camera.position.copy(centre).addScaledVector(direction.clone().normalize(), fitDistance(b, direction, 45, aspect));
        camera.lookAt(centre); camera.updateMatrixWorld();
        let occupied = 0;
        for (const x of [b.x0, b.x1]) for (const y of [b.bottom, b.top]) for (const z of [b.z0, b.z1]) {
          const v = new Vector3(x, y, z).project(camera);
          expect(Math.abs(v.x)).toBeLessThanOrEqual(0.927); expect(Math.abs(v.y)).toBeLessThanOrEqual(0.927);
          expect(v.z).toBeLessThan(1); expect(v.z).toBeGreaterThan(-1);
          occupied = Math.max(occupied, Math.abs(v.x), Math.abs(v.y));
        }
        expect(occupied).toBeGreaterThan(0.86);
      }
    });
  }
});
