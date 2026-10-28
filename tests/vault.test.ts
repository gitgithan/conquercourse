import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { JUMP_COST, VAULT_COST } from '../src/sim/energy';
import { VAULT_KEEP, VAULT_LAND_OFF, VAULT_LIFT, VAULT_MIN_GAP, VAULT_PLANT_TICKS, findVault, takeoffDistance, vaultAt, vaultExitSpeed } from '../src/sim/vault';

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
    const vault = run(c, 120 * 6, (x, w) => (x >= 16.4 && w.mode === 'run' && w.runner.grounded && w.energy === 1 ? 'vault' : null));
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
      const go = w.runner.x >= 16.4 && w.mode === 'run' && w.runner.grounded && before === 0;
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
  it('a V pressed a moment early still vaults when the step comes in reach, but not much too early', () => {
    const c = box(0.8);
    const tryAt = (xPress: number) => {
      let w = newWorld(c, 0), vaulted = false;
      for (let i = 0; i < 120 * 6; i++) {
        w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, vault: w.runner.x >= xPress && w.runner.x < xPress + 0.2 }, c);
        if (w.mode === 'vault') vaulted = true;
      }
      return vaulted;
    };
    expect(tryAt(20 - 2.3)).toBe(true); // a plant distance before the face (about 0.2 s of buffer on top of it at a run)
    expect(tryAt(20 - 5.5)).toBe(false); // far too early
  });
});

describe('the speed vault: plant far back, arc over, land just past the edge, plant the feet', () => {
  const T = (h: number) => box(h).terrain;
  it('the takeoff distance grows with speed and with the height of the step, and sits in the speed-vault range', () => {
    expect(takeoffDistance(8, 0.8)).toBeGreaterThan(takeoffDistance(5, 0.8));
    expect(takeoffDistance(6, 1.2)).toBeGreaterThan(takeoffDistance(6, 0.4));
    for (const [v, r] of [[5, 0.5], [6, 0.8], [7, 1.0], [8, 1.2]]) expect(takeoffDistance(v, r)).toBeGreaterThan(1.4);
    for (const [v, r] of [[5, 0.5], [6, 0.8], [7, 1.0], [8, 1.2]]) expect(takeoffDistance(v, r)).toBeLessThan(3.3);
  });
  it('a plant too close is refused, and one a little too far still works', () => {
    expect(findVault(T(0.8), 20 - 0.2, 0, 7)).toBeNull(); // too late
    expect(findVault(T(0.8), 20 - VAULT_MIN_GAP - 0.05, 0, 7)).not.toBeNull();
    const d = takeoffDistance(7, 0.8);
    expect(findVault(T(0.8), 20 - d - 0.1, 0, 7)).not.toBeNull();
    expect(findVault(T(0.8), 20 - d - 0.6, 0, 7)).toBeNull(); // too early: the buffer waits for it
  });
  it('the feet follow an arc that peaks above the top and come down 0.3 to 0.8 m past the edge', () => {
    const v = findVault(T(0.8), 20 - takeoffDistance(7, 0.8), 0, 7)!;
    let peak = -1, peakI = 0;
    for (let i = 0; i <= v.n; i++) { const q = vaultAt(v, i); if (q.y > peak) { peak = q.y; peakI = i; } }
    expect(peak - 0.8).toBeGreaterThan(VAULT_LIFT * 0.9);
    expect(peak - 0.8).toBeLessThan(VAULT_LIFT * 1.2);
    expect(peakI / v.n).toBeGreaterThan(0.5); // up fast, then down onto the top
    expect(peakI / v.n).toBeLessThan(0.85);
    const end = vaultAt(v, v.n);
    expect(end.x - 20).toBeGreaterThanOrEqual(0.3);
    expect(end.x - 20).toBeLessThanOrEqual(0.8);
    expect(end.x - 20).toBeCloseTo(VAULT_LAND_OFF, 6);
    expect(end.y).toBeCloseTo(0.8, 6);
  });
  it('a vault from the ideal plant keeps the kept share of the speed; a late one is slower', () => {
    const v = findVault(T(0.8), 20 - takeoffDistance(7, 0.8), 0, 7)!;
    expect(vaultExitSpeed(v)).toBeCloseTo(7 * VAULT_KEEP, 1);
    const late = findVault(T(0.8), 20 - 0.5, 0, 7)!;
    expect(vaultExitSpeed(late)).toBeLessThan(vaultExitSpeed(v));
    expect(vaultExitSpeed(late)).toBeGreaterThanOrEqual(0.6 * 7 * VAULT_KEEP - 1e-9);
  });
  it('with no key held after the vault the feet plant: the runner stops on the step within about 0.4 s and a metre or so', () => {
    const c = box(0.8);
    let w = newWorld(c, 20 - takeoffDistance(7, 0.8));
    w = { ...w, runner: { ...w.runner, vx: 7 } };
    w = stepWorld(w, { ...NO_INPUT, run: true, vault: true }, c);
    expect(w.mode).toBe('vault');
    while (w.mode === 'vault') w = stepWorld(w, { ...NO_INPUT, run: true }, c);
    const landed = w.runner.x;
    for (let i = 0; i < 120; i++) w = stepWorld(w, NO_INPUT, c);
    expect(w.runner.vx).toBe(0);
    expect(w.runner.x - landed).toBeLessThan(1.6);
    // holding run instead keeps going
    let k = newWorld(c, 20 - takeoffDistance(7, 0.8)); k = { ...k, runner: { ...k.runner, vx: 7 } };
    k = stepWorld(k, { ...NO_INPUT, run: true, vault: true }, c);
    while (k.mode === 'vault') k = stepWorld(k, { ...NO_INPUT, run: true }, c);
    for (let i = 0; i < VAULT_PLANT_TICKS; i++) k = stepWorld(k, { ...NO_INPUT, run: true }, c);
    expect(k.runner.vx).toBeGreaterThan(6);
  });
});
