import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { routeCourse, routeOfTrack } from '../src/sim/branches';
import { BULB_BAND_LO, DEFAULT_FORK, buildForkCourse } from '../src/sim/fork';
import { playPlan } from '../src/sim/ideal';
import { NO_INPUT } from '../src/sim/runner';
import { recordPlan, trackFromPlan, verifyLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';
import { loadDemo } from './helpers/course';

// CC-133: one fork with one gate, two lanes over the same picture. Bench lane: run and vault three benches. Bulb lane: climb the pole, swing along the bars.
const course = loadDemo('fork-bench-bulb.course.json');
const b = course.branches![0];

describe('the fork with one gate', () => {
  it('has two lanes, each with a stored line and a time, and the course plan is the faster one', () => {
    expect(b.routes.map((r) => r.id)).toEqual(['bench', 'bulb']);
    for (const r of b.routes) { expect(r.plan).toBeDefined(); expect(r.ticks).toBeGreaterThan(0); }
    expect(course.plan).toEqual(b.routes.reduce((a, c) => (c.ticks! < a.ticks! ? c : a)).plan);
  });
  it('proves each lane on its own: the stored line clears with the other lane closed, in the stored time', () => {
    for (const r of b.routes) {
      const res = playPlan(routeCourse(course, b.id, r.id), r.plan!);
      expect(res.world.outcome, r.id).toBe('cleared');
      expect(res.world.runner.tick, r.id).toBe(r.ticks);
    }
  });
  it('each line also clears the whole course, and the lane it takes is read from its track', () => {
    for (const r of b.routes) {
      expect(playPlan(course, r.plan!).world.outcome, r.id).toBe('cleared');
      const t = trackFromPlan(course, r.plan!);
      expect(routeOfTrack(b, t.xs, t.ys)?.id, r.id).toBe(r.id);
    }
  });
  it('a server replay of the keys proves a clear on EITHER lane, in exactly the stored time', () => {
    for (const r of b.routes) {
      const { recorder } = recordPlan(course, r.plan!);
      const v = verifyLog(course, recorder.snapshot());
      expect(v.cleared, r.id).toBe(true);
      expect(v.ticks, r.id).toBe(r.ticks);
      expect(routeOfTrack(b, v.track.xs, v.track.ys)?.id, r.id).toBe(r.id);
    }
  });
  it('closing a lane removes only that lane\'s things, and leaves the original course whole', () => {
    const before = JSON.stringify(course);
    const bench = routeCourse(course, b.id, 'bench'); // the bulb lane closed
    expect(bench.holds).toEqual([]);
    expect(bench.climbPoles).toBeUndefined();
    expect(bench.terrain.platforms).toHaveLength(course.terrain.platforms.length);
    const bulb = routeCourse(course, b.id, 'bulb'); // the bench lane closed: no floor between the pole and the join
    expect(bulb.holds).toHaveLength(course.holds!.length);
    expect(bulb.climbPoles).toHaveLength(1);
    expect(bulb.terrain.platforms).toHaveLength(2);
    expect(JSON.stringify(course)).toBe(before);
  });
  it('the bulb lane on its own has no floor under the bars: a fall is a splash, not a way', () => {
    const sub = routeCourse(course, b.id, 'bulb');
    const fall = playPlan(sub, { ...b.routes[1].plan!, hangTicks: b.routes[1].plan!.hangTicks!.map((t, i) => (i === 0 ? 4000 : t)) }, 120 * 12);
    expect(fall.world.outcome).not.toBe('cleared');
  });
});

describe('the pits: no floor between the run-up, the benches and the join', () => {
  const ps = course.terrain.platforms;
  it('only the run-up, the three benches and the join are floor; every gap between them is a pit', () => {
    expect(ps).toHaveLength(5);
    expect(ps.slice(1, 4).every((p) => p.top === DEFAULT_FORK.benches[0].top)).toBe(true);
    for (let i = 0; i < ps.length - 1; i++) expect(ps[i + 1].x0 - ps[i].x1, `gap ${i}`).toBeGreaterThan(1);
  });
  it('each gap is short enough to clear: at most 2.3 m', () => {
    for (let i = 0; i < ps.length - 1; i++) expect(ps[i + 1].x0 - ps[i].x1).toBeLessThanOrEqual(2.3);
  });
  it('walking off the run-up without a jump falls into the pit, not onto a floor', () => {
    let w = newWorld(course, DEFAULT_FORK.poleX - 3);
    for (let i = 0; i < 600 && w.runner.y > course.terrain.waterY + 0.5 && w.outcome === 'running'; i++) w = stepWorld(w, { ...NO_INPUT, run: true } as never, course);
    expect(w.runner.y).toBeLessThan(0);
  });
  it('the benches are drawn as scene items by default (no fork=1 needed)', () => {
    expect(course.scene!.filter((s) => s.id?.startsWith('bench'))).toHaveLength(3);
    expect(course.scene!.some((s) => s.id === 'pole-1')).toBe(true);
  });
});

describe('the gate: the first move picks the lane, nothing else does', () => {
  const run = (x: number, inp: object, n: number) => { let w = newWorld(course, x); for (let i = 0; i < n; i++) w = stepWorld(w, { ...NO_INPUT, ...inp } as never, course); return w; };
  it('running past the pole without E stays on the ground: the bench lane', () => {
    const w = run(DEFAULT_FORK.poleX - 3, { run: true }, 120);
    expect(w.mode).toBe('run');
    expect(w.runner.x).toBeGreaterThan(DEFAULT_FORK.poleX);
  });
  it('holding E at the pole is the bulb lane: the body climbs', () => {
    const w = run(DEFAULT_FORK.poleX, { handL: true, handR: true }, 60);
    expect(w.mode).toBe('polec');
    expect(w.runner.y).toBeGreaterThan(0.4);
  });
  it('the bars are out of a jump\'s reach from the ground and from a bench top, so no jump grabs them', () => {
    for (let x = 10.6; x < 25; x += 0.35) {
      let w = newWorld(course, x);
      let hung = false;
      for (let i = 0; i < 160 && !hung; i++) {
        w = stepWorld(w, { ...NO_INPUT, run: i % 40 < 30, jump: i % 40 === 0, handL: true, handR: true } as never, course);
        hung = w.mode === 'hang';
      }
      expect(hung, `jump from x ${x.toFixed(2)}`).toBe(false);
    }
  });
  it('the lanes are told apart by the lowest height between the fork and the join', () => {
    expect(b.routes[0].band[1]).toBe(BULB_BAND_LO);
    expect(b.routes[1].band[0]).toBe(BULB_BAND_LO);
    expect(buildForkCourse().branches![0].forkX).toBeGreaterThan(DEFAULT_FORK.poleX);
  });
  it('every scene item draws a real lifted object from a file, not a hand-built shape', () => {
    const items = (course as { scene?: { id?: string; url?: string; mesh?: unknown }[] }).scene ?? [];
    expect(items.map((i) => i.id)).toEqual(['bench-1', 'bench-2', 'bench-3', 'pole-1', 'bulbs-1']);
    for (const it of items) {
      expect(it.mesh, it.id).toBeUndefined();
      expect(it.url, it.id).toMatch(/^\/assets\/demo\/fork-objects\/fork-(bench|pole|bulbs)\.glb$/);
      expect(existsSync(`public${it.url}`), it.id).toBe(true);
      expect(statSync(`public${it.url}`).size, `${it.id} stays small`).toBeLessThan(300 * 1024);
    }
  });
});
