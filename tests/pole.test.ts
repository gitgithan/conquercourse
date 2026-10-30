// CC-239: the pole vault obeys the physics: no energy is added, speed buys height, too slow falls back, and the release has a window.
import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../src/sim/units';
import { DEFAULT_POLE, plantState, poleEnergy, releaseWindow, vault } from '../src/sim/pole';

const bar = { x: 0.5, height: 4.5 };
const lossless = { ...DEFAULT_POLE, damping: 0 };

describe('pole vault', () => {
  it('with no damping the pole keeps the energy it was given', () => {
    const s = plantState(8, lossless);
    const e0 = poleEnergy(s, lossless);
    const r = vault(8, { x: 99, height: 99 }, 60, lossless);
    // while held the path stays on the energy surface: check the last held step
    const held = r.path.filter((q) => q.held);
    expect(held.length).toBeGreaterThan(20);
    const last = held[held.length - 1];
    const prev = held[held.length - 2];
    // body speed from successive positions
    const v2 = ((last.x - prev.x) ** 2 + (last.y - prev.y) ** 2) * 120 * 120;
    const e = 0.5 * v2 + GRAVITY * last.y + 0.5 * lossless.stiffness * (lossless.length - last.r) ** 2;
    expect(Math.abs(e - e0) / e0).toBeLessThan(0.03);
  });
  it('the body never goes higher than its speed and starting height allow', () => {
    for (const v of [5, 7, 9]) {
      const top = Math.max(...[...Array(120)].map((_, i) => vault(v, bar, i + 1).apexY));
      expect(top).toBeLessThanOrEqual(DEFAULT_POLE.gripY + (v * v) / (2 * GRAVITY) + 1e-6);
    }
  });
  it('faster runners reach higher', () => {
    const best = (v: number) => Math.max(...[...Array(150)].map((_, i) => vault(v, bar, i + 1).apexY));
    expect(best(6)).toBeLessThan(best(7)); expect(best(7)).toBeLessThan(best(8));
  });
  it('too slow: the pole stands up and the runner falls back', () => {
    expect(vault(5, bar, null).outcome).toBe('fell_back');
  });
  it('a release has a window: too early is short, in the window clears, held too long knocks the bar', () => {
    const w = releaseWindow(8, bar);
    expect(w).not.toBeNull();
    expect(w!.last - w!.first).toBeGreaterThan(10); // at least 80 ms of timing to hit
    expect(vault(8, bar, Math.max(1, w!.first - 25)).outcome).not.toBe('cleared');
    expect(vault(8, bar, w!.first).outcome).toBe('cleared');
    expect(vault(8, bar, w!.last + 40).outcome).toBe('hit_bar');
    expect(vault(8, bar, null).outcome).toBe('hit_bar'); // never letting go is the same
  });
  it('the pole has to suit the speed: a stiff pole at a slow run falls back, a soft pole at a fast run is too weak', () => {
    const stiff = { ...DEFAULT_POLE, stiffness: 20 }, soft = { ...DEFAULT_POLE, stiffness: 9 };
    expect(releaseWindow(9, bar, stiff)).not.toBeNull();
    expect(releaseWindow(7, bar, stiff)).toBeNull();
    expect(releaseWindow(9, bar, soft)).toBeNull();
    expect(releaseWindow(7, { x: 0.5, height: 3.6 }, soft)).not.toBeNull();
  });
  it('a higher bar needs more speed and a stiffer pole', () => {
    const high = { x: 0.5, height: 4.9 }, stiff = { ...DEFAULT_POLE, stiffness: 20 };
    expect(releaseWindow(9, high, stiff)).not.toBeNull();
    expect(releaseWindow(7, high, stiff)).toBeNull();
  });
  it('a cleared vault lands on the cushion beyond the bar', () => {
    const w = releaseWindow(8, bar)!;
    const r = vault(8, bar, Math.round((w.first + w.last) / 2));
    expect(r.outcome).toBe('cleared');
    expect(r.landX!).toBeGreaterThan(bar.x);
    expect(r.landVy!).toBeGreaterThan(0);
  });
});
