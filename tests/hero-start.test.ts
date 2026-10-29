import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { laneToEditor } from '../src/slice/hero-start';
import { uToX, type BackdropFrame } from '../src/world/backdrop';

const b = JSON.parse(readFileSync('public/assets/demo/hero-montmartre-paris.backdrop.json', 'utf8')) as BackdropFrame;

describe('editor start scene (CC-238)', () => {
  it('puts a lane point back on the lane: across-lane distance 0, along-lane maps to the same course x', () => {
    for (const x of [10, 22.7, 30.5]) {
      const p = laneToEditor(b, x, -0.1), c = Math.cos(b.angle), s = Math.sin(b.angle);
      expect(-p.x * s + p.z * c - b.offset).toBeCloseTo(0, 6);
      expect(uToX(b.uMap, p.x * c + p.z * s)).toBeCloseTo(x, 3);
      expect(p.y).toBeCloseTo(-0.1 + b.level, 6);
    }
  });
});
