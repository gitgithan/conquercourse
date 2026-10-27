import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { JUMP_COST, VAULT_COST } from '../src/sim/energy';
import { VAULT_KEEP } from '../src/sim/vault';

// A deck, then a tall step (a box), then more deck on top of it.
const box = (h: number): CourseData => ({
  version: 1, name: 'vault', startX: 0, finishX: 40, jumpSpeed: 4.5,
  terrain: { waterY: -1.5, platforms: [{ x0: -10, x1: 20, top: 0 }, { x0: 20, x1: 45, top: h }] },
  jumpKeep: 0.88, // a jump costs speed on this course, so the vault pays
});
const run = (c: CourseData, ticks: number, press: (x: number, w: ReturnType<typeof newWorld>) => 'jump' | 'vault' | null) => {
  let w = newWorld(c, 0);
  const log: { x: number; vx: number; tick: number }[] = [];
  for (let i = 0; i < ticks; i++) {
    const p = press(w.runner.x, w);
    w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, jump: p === 'jump', vault: p === 'vault' }, c);
    log.push({ x: w.runner.x, vx: w.runner.vx, tick: w.runner.tick });
  }
  return { w, log };
};

describe('the vault', () => {
  it('goes over a 1.2 m step that no jump can climb, and the search finds it', () => {
    const r = searchIdealRun(box(1.2));
    expect(r.cleared).toBe(true);
    expect(r.plan.vaultXs?.length).toBe(1);
    expect(playPlan(box(1.2), { jumpXs: [19], releaseAfter: 60, bouncePress: 8 }).world.outcome).not.toBe('cleared'); // a jump alone does not
  });
  it('keeps most of the speed and spends less energy than a jump over the same 0.8 m step', () => {
    const c = box(0.8);
    const vault = run(c, 120 * 6, (x, w) => (x >= 19.2 && w.mode === 'run' && w.runner.grounded && w.energy === 1 ? 'vault' : null));
    const jump = run(c, 120 * 6, (x, w) => (x >= 17.5 && w.runner.grounded && w.energy === 1 ? 'jump' : null));
    expect(vault.w.energy).toBeCloseTo(1 - VAULT_COST, 6);
    expect(jump.w.energy).toBeCloseTo(1 - JUMP_COST, 6);
    expect(vault.w.energy).toBeGreaterThan(jump.w.energy);
    // the vaulter gets to the same point sooner
    const at = (r: typeof vault, x: number) => r.log.find((q) => q.x >= x)!.tick;
    expect(at(vault, 28)).toBeLessThan(at(jump, 28));
  });
  it('the speed after the vault is the speed before it times the kept share', () => {
    const c = box(0.8);
    let w = newWorld(c, 0), before = 0;
    for (let i = 0; i < 120 * 6; i++) {
      const go = w.runner.x >= 19.2 && w.mode === 'run' && w.runner.grounded && before === 0;
      if (go) before = w.runner.vx;
      w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, vault: go }, c);
      if (before && w.mode === 'run' && w.runner.grounded && w.runner.y > 0.7) { expect(w.runner.vx).toBeGreaterThan(before * VAULT_KEEP * 0.98); break; }
    }
    expect(before).toBeGreaterThan(5);
  });
  it('does nothing from a standstill, over a step that is too tall, or over a gap', () => {
    const still = stepWorld(newWorld(box(0.8), 19.5), { ...NO_INPUT, vault: true }, box(0.8));
    expect(still.mode).toBe('run');
    const tall = run(box(1.6), 120 * 4, (x, w) => (x >= 19.2 && w.mode === 'run' ? 'vault' : null));
    expect(tall.w.mode).toBe('run');
    expect(tall.w.runner.x).toBeLessThan(21);
  });
});
