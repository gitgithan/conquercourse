import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { inputFor, playPlan } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { BOX_H, DX, TRAMP_CUT } from '../scripts/training-layout';
import { logTick, newLog } from '../src/ui/run-report';

// The Training course (CC-97) shows every move in one chain, and the efficient line is not the obvious one.
const c = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
function play() {
  let w = newWorld(c); const log = newLog();
  const st = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null } as unknown as Parameters<typeof inputFor>[2];
  for (let i = 0; i < 120 * 120 && w.outcome === 'running'; i++) { w = stepWorld(w, inputFor(c.plan!, w, st, c), c); logTick(log, w); }
  return { w, log };
}
describe('the Training course', () => {
  const { w, log } = play();
  const best = playPlan(c, c.plan!, 120 * 120);
  it('clears with its stored plan, on the ground, after the last obstacle', () => {
    expect(w.outcome).toBe('cleared');
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.x).toBeGreaterThanOrEqual(c.finishX);
  });
  it('uses every move: jump, vault, bar grab, climb, trampoline bounce and a roll', () => {
    const kinds = new Set(log.moves.map((m) => m.kind));
    for (const k of ['jump', 'vault', 'grab', 'climb', 'bounce', 'roll']) expect(kinds.has(k as never), k).toBe(true);
  });
  it('has one zone per beat, in the order they come', () => {
    expect(c.zones!.map((z) => z.id)).toEqual(['gap', 'vault', 'wall', 'climb', 'plank', 'lache', 'rope', 'trampoline', 'drop']); // CC-175: the hands key comes early (warped wall before the climb and the bars)
    const xs = c.zones!.map((z) => z.x0); expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });
  it('every basic obstacle is there and cleared: the warped wall (hands on E), the plank bridge (CC-175)', () => {
    expect(c.wall?.height).toBe(4);
    expect(c.planks).toHaveLength(1);
    const ev = best.events.map((e) => e.type);
    expect(ev).toContain('wall-grab');
    expect(ev).not.toContain('wall-no-grip');
    expect(ev).not.toContain('wall-slide');
    expect(ev).toContain('plank-sag');
    expect(ev).not.toContain('plank-break');
    expect(best.events.filter((e) => e.type === 'vault')).toHaveLength(1); // the box (CC-196: the 0.5 m step, a second V on a low bump, is gone)
    expect(ev.indexOf('wall-grab')).toBeLessThan(ev.indexOf('climb')); // E is learnt on the wall before the climb and the bars need it
    expect(ev.indexOf('climb')).toBeLessThan(ev.indexOf('hang-catch'));
  });
  it('the lache gap is wider than a jump, so the bars are needed', () => {
    const p = c.terrain.platforms, gaps = p.slice(1).map((q, i) => q.x0 - p[i].x1);
    expect(Math.max(...gaps.filter((g) => g > 9))).toBeGreaterThan(8.5);
  });
  it('the best line is the shortcut: skipping the second bar saves time, and the search finds it', () => {
    expect(c.shortcuts?.some((s) => s.id === 'skip-bar-2' && s.secondsSaved >= 0.5)).toBe(true);
    expect(c.routes?.find((r) => r.chosen)?.bars).toBe(1);
    expect(c.shortcuts?.some((s) => s.skipped.length === 2)).toBe(false); // no jump clears the gap without the bars
    expect(best.events.filter((e) => e.type === 'hang-catch')).toHaveLength(1);
  });
  it('the drop after the shortcut needs a roll, and so does the one at the end; the rope landing does not', () => {
    const big = best.events.filter((e) => e.type === 'land').map((e) => e.detail as { impact: number; rolled: boolean }).filter((l) => l.impact > 8);
    expect(big.map((l) => l.rolled)).toEqual([true, true]);
    const rolls = log.moves.filter((m) => m.kind === 'roll').map((m) => m.x);
    expect(rolls).toHaveLength(2);
    expect(rolls[0]).toBeGreaterThan(73 + DX); expect(rolls[0]).toBeLessThan(86 + DX);
    expect(rolls[1]).toBeGreaterThan(160 + DX - TRAMP_CUT);
  });
  it('the slower bar-to-bar line still clears, and its drop after bar 2 also needs a roll', () => {
    const r = playPlan(c, { ...c.plan!, hangTicks: [210, 210], airHands: undefined }, 120 * 120);
    expect(r.world.outcome).toBe('cleared');
    expect(r.events.filter((e) => e.type === 'hang-catch').length).toBeGreaterThanOrEqual(2);
    expect(r.world.runner.tick).toBeGreaterThan(c.routes!.find((q) => q.chosen)!.ticks + 120);
    const drop = r.events.filter((e) => e.type === 'land').map((e) => e.detail as { impact: number; rolled: boolean }).find((l) => l.impact > 8);
    expect(drop?.rolled).toBe(true);
  });
  it('the first box is as high as a vault can be (CC-182: doubled is not possible, the limit is 1.3 m), and the bar grab is tight', async () => {
    const box = c.terrain.platforms.find((p) => p.top > 0 && p.top < 2)!;
    expect(box.top).toBe(BOX_H);
    expect(BOX_H).toBeGreaterThanOrEqual(1.2); expect(BOX_H).toBeLessThanOrEqual(1.3);
    expect(c.grabReach).toBeLessThanOrEqual(0.2); // CC-193: the hands touch the bar at the grab (it was 0.35: the hands looked a forearm away)
    const { playPlan } = await import('../src/sim/ideal');
    let first = 9;
    playPlan(c, c.plan!, 120 * 60, (w) => { if (first === 9 && w.mode === 'hang' && w.hang && w.hang.et === 8) first = Math.hypot(w.hang.ox!, w.hang.oy!); });
    expect(first, 'distance from the hands to the first bar at the grab tick, m').toBeLessThanOrEqual(0.15);
  });
  it('no long flat run: every deck before the first bar is short', () => {
    for (const p of c.terrain.platforms.filter((q) => q.x1 < 62 + DX && q.x0 > 0)) expect(p.x1 - p.x0).toBeLessThanOrEqual(24);
  });
  it('the decks touch where a wall or a drop begins (no sliver to fall through)', () => {
    const p = c.terrain.platforms;
    for (let i = 1; i < p.length; i++) { const gap = p[i].x0 - p[i - 1].x1; if (gap > 0) expect(gap).toBeGreaterThan(0.5); }
  });
});

// CC-216: the climb wall (top 6 m, 2 m above the deck before it) is out of reach of a plain jump (the apex is about 1 m): it is climbed with E.
// A player who holds E from a few metres before the wall and presses Space anywhere in a wide window (or not at all) must get up, as the ideal run does.
describe('the climb wall is reachable by a human-timed single jump with E held (CC-216)', () => {
  const wall = c.terrain.platforms.find((p) => p.top === 6)!;
  const climbs = (jumpAt: number | null, holdE: boolean) => {
    let w = newWorld(c, 80), got = false;
    for (let i = 0; i < 1200 && w.runner.x < wall.x0 + 4; i++) {
      const x = w.runner.x;
      w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, jump: jumpAt !== null && x >= jumpAt && x < jumpAt + 0.3, handL: holdE && x >= wall.x0 - 7, handR: holdE && x >= wall.x0 - 7 } as never, c);
      if (w.mode === 'climb') got = true;
    }
    return got;
  };
  it('it is 2 m high and a plain jump does not reach the top', () => {
    expect(wall.top - 4).toBe(2);
    expect(climbs(wall.x0 - 3, false)).toBe(false);
  });
  it('E held from 7 m before: standing, or a jump anywhere from 3.5 m to 0.5 m before the wall, climbs', () => {
    expect(climbs(null, true)).toBe(true);
    for (let d = 0.5; d <= 3.5; d += 0.5) expect(climbs(wall.x0 - d, true), `jump ${d} m before`).toBe(true);
  });
});
