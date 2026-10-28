import { describe, expect, it } from 'vitest';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { DEFAULT_BAND, bandAccel, bandOnlySpeed, bandParams, reachableStretch, slackX, storedEnergy, stretchAt, type BandParams } from '../src/sim/band';
import { bandCourse, pullAndGo } from '../scripts/band-explore';

// The elastic band is a spring that can only pull: the physics laws first, then the game rules.
describe('the band as a spring', () => {
  const p: BandParams = { ...DEFAULT_BAND, k: 45 };
  it('stores half k x squared and gives all of it back as motion when nothing else acts', () => {
    const s = 10, E = storedEnergy(p, s);
    expect(E).toBeCloseTo(0.5 * 45 * 100, 9);
    // integrate a mass on the band alone (no legs, no friction) from stretch s back to the slack point with a tiny step
    let x = slackX(p) - s, v = 0;
    const dt = 1e-4;
    while (stretchAt(p, x) > 0) { v += bandAccel(p, x) * dt; x += v * dt; }
    expect(v).toBeCloseTo(bandOnlySpeed(p, s), 1); // within 0.05 m/s of sqrt(2E/m)
    expect(0.5 * p.mass * v * v).toBeLessThanOrEqual(E * 1.01); // it can never give back more than it stored
  });
  it('pulls only while it is stretched, toward the post, and never pushes', () => {
    expect(bandAccel(p, slackX(p))).toBe(0);
    expect(bandAccel(p, slackX(p) + 3)).toBe(0); // closer to the post than the slack point: loose
    expect(bandAccel(p, slackX(p) - 4)).toBeCloseTo((45 * 4) / 70, 9);
  });
  it('a full push of the legs stretches it to where its pull equals the push, and a softer band goes farther', () => {
    const reach = [300, 150, 90, 45, 28].map((k) => reachableStretch({ ...p, k, snap: 100 }));
    for (let i = 1; i < reach.length; i++) expect(reach[i]).toBeGreaterThan(reach[i - 1]);
    expect(reachableStretch({ ...p, k: 45, snap: 100 })).toBeCloseTo((10 * 70) / 45, 6); // acceleration x mass / k
    expect(reachableStretch({ ...p, k: 45, snap: 8 })).toBe(8); // the snap limit caps it
  });
});

describe('the band in the world', () => {
  it('stays clipped on while the runner stands, and unclips when the runner just runs toward the post', () => {
    const c = bandCourse();
    let w = newWorld(c);
    expect(w.mode).toBe('band');
    for (let i = 0; i < 240; i++) w = stepWorld(w, NO_INPUT, c);
    expect(w.mode).toBe('band');
    for (let i = 0; i < 20; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, c);
    expect(w.mode).toBe('run');
    expect(w.band).toBeNull();
  });
  it('a pull stretches it as far as the push allows (not much past where the pull equals the push)', () => {
    for (const k of [150, 90, 45]) {
      const c = bandCourse({ k, snap: 100 });
      let w = newWorld(c), far = 0;
      for (let i = 0; i < 120 * 40; i++) { w = stepWorld(w, { ...NO_INPUT, left: true }, c); far = Math.max(far, stretchAt(bandParams(c), w.runner.x)); }
      const reach = reachableStretch(bandParams(c));
      expect(far).toBeGreaterThan(reach * 0.85);
      expect(far).toBeLessThan(reach * 1.35); // momentum carries the runner a little past the point where the pull equals the push
    }
  });
  it('the band never pushes the runner forward with more work than it stored', () => {
    for (const k of [45, 90]) {
      const c = bandCourse({ k, snap: 100 });
      const reach = reachableStretch(bandParams(c));
      const r = pullAndGo(c, reach * 0.85);
      expect(r.release).not.toBeNull();
      let w = newWorld(c), release: { work: number; stretch: number } | null = null, turned = false;
      for (let i = 0; i < 120 * 60 && !release; i++) {
        const s = stretchAt(bandParams(c), w.runner.x);
        if (s >= reach * 0.85) turned = true;
        w = stepWorld(w, w.mode === 'band' ? { ...NO_INPUT, left: !turned, run: turned } : NO_INPUT, c);
        const e = w.events.find((q) => q.type === 'band-release');
        if (e) release = { work: e.detail!.work as number, stretch: e.detail!.stretch as number };
      }
      expect(release).not.toBeNull();
      expect(release!.work).toBeLessThanOrEqual(storedEnergy(bandParams(c), release!.stretch) * 1.03); // the push forward is paid for by what was stored
      expect(release!.work).toBeGreaterThan(storedEnergy(bandParams(c), release!.stretch) * 0.6); // and most of it is given back
    }
  });
  it('a softer band throws faster, until the snap limit holds the stretch back', () => {
    const v = (k: number, snap = 40) => { const c = bandCourse({ k, snap }); return pullAndGo(c, Math.min(reachableStretch(bandParams(c)) * 0.85, snap - 0.5)).edgeV; };
    const speeds = [300, 150, 90, 60, 45, 35, 28].map((k) => v(k));
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
    expect(speeds[speeds.length - 1]).toBeGreaterThan(12); // well past the 9 m/s top speed
    // with a short snap limit the stretch is capped, so a band that is too soft does worse than a firmer one
    expect(v(28, 8)).toBeLessThan(v(60, 8));
  });
  it('a band that is too stiff hardly stretches and gives no boost', () => {
    const c = bandCourse({ k: 1500, snap: 40 });
    const r = pullAndGo(c, 0.4);
    expect(r.maxStretch).toBeLessThan(0.6);
    expect(r.edgeV).toBeLessThan(7); // under the 9 m/s a plain run reaches
  });
  it('a band stretched past its limit snaps: it lets go, nobody is hurt, the run goes on', () => {
    const c = bandCourse({ k: 28, snap: 6 });
    let w = newWorld(c), snapped = false;
    for (let i = 0; i < 120 * 30 && !snapped; i++) { w = stepWorld(w, { ...NO_INPUT, left: true }, c); snapped = w.events.some((e) => e.type === 'band-snap'); }
    expect(snapped).toBe(true);
    expect(w.mode).toBe('run');
    expect(w.outcome).toBe('running');
  });
  it('is deterministic: the same inputs give the same run', () => {
    const run = () => pullAndGo(bandCourse({ k: 45 }), 9).edgeV;
    expect(run()).toBe(run());
  });
});
