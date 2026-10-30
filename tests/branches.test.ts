import { describe, expect, it } from 'vitest';
import { branchesOf, fastestRoute, routeCourse, routeOfPath, routeOfTrack } from '../src/sim/branches';
import { playPlan } from '../src/sim/ideal';
import { recordPlan, trackFromPlan, verifyLog } from '../src/sim/replay';
import { loadDemo as load } from './helpers/course';

// CC-224: a fork with two ways. Each way has its own proved line; the way taken is read from where the runner went.
const course = load('two-ways.course.json');
const b = course.branches![0];

describe('a course with a fork', () => {
  it('a course without branches has none', () => { expect(branchesOf(load('training.course.json'))).toEqual([]); });
  it('has two ways, each with a stored line and a time', () => {
    expect(b.routes.map((r) => r.id)).toEqual(['high', 'low']);
    for (const r of b.routes) { expect(r.plan).toBeDefined(); expect(r.ticks).toBeGreaterThan(0); }
  });
  it('proves each way on its own: the stored line clears with the other way closed, in the stored time', () => {
    for (const r of b.routes) {
      const sub = routeCourse(course, b.id, r.id);
      const res = playPlan(sub, r.plan!);
      expect(res.world.outcome, r.id).toBe('cleared');
      expect(res.world.runner.tick, r.id).toBe(r.ticks);
    }
  });
  it('closing a way leaves the original course whole', () => {
    const before = JSON.stringify(course);
    const sub = routeCourse(course, b.id, 'low');
    expect(sub.holds ?? []).toHaveLength(0);
    expect(sub.terrain.platforms).toHaveLength(course.terrain.platforms.length);
    const sub2 = routeCourse(course, b.id, 'high');
    expect(sub2.terrain.platforms).toHaveLength(course.terrain.platforms.length - 3);
    expect(JSON.stringify(course)).toBe(before);
  });
  it('the course plan is the faster way', () => {
    expect(course.plan).toEqual(fastestRoute(b)!.plan);
  });
  it('each line also clears the whole course, and the way it takes is read correctly from its track', () => {
    for (const r of b.routes) {
      expect(playPlan(course, r.plan!).world.outcome, r.id).toBe('cleared');
      const t = trackFromPlan(course, r.plan!);
      expect(routeOfTrack(b, t.xs, t.ys)?.id, r.id).toBe(r.id);
    }
  });
  it('the way taken is read from a key log too (what a server replay has)', () => {
    for (const r of b.routes) {
      const log = recordPlan(course, r.plan!).recorder.snapshot();
      const v = verifyLog(course, log);
      expect(v.cleared).toBe(true);
      expect(routeOfTrack(b, v.track.xs, v.track.ys)?.id, r.id).toBe(r.id);
    }
  });
  it('the two ways differ in time, in effort and in how little room they leave (facts, not grades)', () => {
    const [h, l] = [b.routes[0], b.routes[1]];
    expect(h.ticks).not.toBe(l.ticks);
    expect(h.effort).not.toBe(l.effort);
    expect(h.narrowestMs!).toBeLessThan(l.narrowestMs!);
  });
});

describe('reading the way from a path', () => {
  const path = (ys: number[]) => ys.map((y, i) => ({ x: b.forkX + i * ((b.joinX - b.forkX + 2) / (ys.length - 1)), y }));
  it('flying over at height is the high way, touching down low is the low way', () => {
    expect(routeOfPath(b, path([0, 2, 1, -1, -2, -2]))?.id).toBe('high');
    expect(routeOfPath(b, path([0, 1, -2, -4.4, -4.4, -2]))?.id).toBe('low');
  });
  it('a run that never reaches the join has no way (a fall is not a way)', () => {
    expect(routeOfPath(b, path([0, 2, 1, -1]).slice(0, 3))).toBeNull();
    expect(routeOfPath(b, [])).toBeNull();
  });
});
