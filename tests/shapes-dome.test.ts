import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../src/slice/shapes';
import { piecesFromSource } from '../src/slice/roundtrip';

describe('the dome piece is gone (CC-96)', () => {
  it('the editor no longer offers a dome', () => {
    expect(LIBRARY.some((l) => l.id === 'dome')).toBe(false);
  });
  it('an old world that has a dome gets a block in its place', () => {
    const out = piecesFromSource([{ src: 'dome', x: 8, z: 1, y: 0, yaw: 0, scale: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0].src).toBe('block');
    expect(out[0].x).toBe(8);
  });
});

describe('the heavy crate piece is gone (CC-96)', () => {
  it('an old world that has a heavy crate gets a launcher with the same numbers', () => {
    const out = piecesFromSource([{ src: 'device:crate:25:6:2.5', x: 3, z: 0, y: 0, yaw: 0, scale: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0].src).toBe('device:cannon:25:6:2.5');
  });
});
