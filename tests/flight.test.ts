import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildingsFrom, type Building, type OverpassAnswer } from '../src/world/osm';
import type { Ground } from '../src/world/terrain';
import { buildingTops, piecesFrom } from '../src/slice/slicer';
import { caption, FLIGHT_SECONDS, flightCamera, rise, runFlight, scaleWords, STEP_ENDS, stepOf, wave } from '../src/modes/map-flight';

describe('the map flight camera', () => {
  const fit = 17;
  it('starts high and flat, ends low and tilted, and never goes backwards', () => {
    const a = flightCamera(0, fit), z = flightCamera(FLIGHT_SECONDS, fit);
    expect(a.pitch).toBe(0);
    expect(a.zoom).toBeLessThan(fit - 3);
    expect(z.pitch).toBeGreaterThan(60);
    expect(z.zoom).toBeGreaterThan(fit);
    let prev = flightCamera(0, fit);
    for (let t = 0; t <= FLIGHT_SECONDS; t += 0.05) {
      const c = flightCamera(t, fit);
      expect(c.pitch).toBeGreaterThanOrEqual(prev.pitch - 1e-9);
      expect(c.zoom).toBeGreaterThanOrEqual(prev.zoom - 1e-9);
      prev = c;
    }
  });
  it('takes under 6 seconds', () => { expect(FLIGHT_SECONDS).toBeLessThan(6); });
  it('holds the bird\'s eye for step 1 and has no jump between steps', () => {
    expect(flightCamera(STEP_ENDS[0] - 0.01, fit)).toEqual(flightCamera(0, fit));
    for (const e of STEP_ENDS) {
      const before = flightCamera(e - 0.001, fit), after = flightCamera(e + 0.001, fit);
      expect(Math.abs(before.zoom - after.zoom)).toBeLessThan(0.02);
      expect(Math.abs(before.pitch - after.pitch)).toBeLessThan(0.5);
    }
  });
  it('names the three steps', () => {
    expect([stepOf(0.5), stepOf(2), stepOf(4.5)]).toEqual([1, 2, 3]);
    expect(caption(0.5, 120)).toMatch(/240 m across/);
    expect(caption(2, 120)).toMatch(/rise out of the map/);
    expect(caption(4.5, 120)).toMatch(/down to the street/);
  });
});

describe('the buildings rising', () => {
  it('nothing rises in step 1, everything has risen by the end of step 2', () => {
    expect(wave(1)).toBe(0);
    expect(rise(1, 0)).toBe(0);
    expect(wave(STEP_ENDS[1])).toBe(1);
    expect(rise(STEP_ENDS[1], 1)).toBe(1);
  });
  it('the wave runs from the middle outward', () => {
    const t = 2.5;
    expect(rise(t, 0)).toBeGreaterThan(rise(t, 0.5));
    expect(rise(t, 0.5)).toBeGreaterThan(rise(t, 1));
    expect(rise(t, 0.5)).toBeGreaterThan(0);
  });
});

describe('the scale in plain words', () => {
  it('says how wide the circle is, what 1 m of the game is, and what a building becomes', () => {
    const w = scaleWords(120, 0.1, 30);
    expect(w).toMatch(/240 m across/);
    expect(w).toMatch(/24 m wide/);
    expect(w).toMatch(/1 m in the game is 10 m in the real place/);
    expect(w).toMatch(/30 m tall building becomes 3 m high/);
  });
  it('has no formula in it', () => { expect(scaleWords(80, 0.25, 12)).not.toMatch(/[=×*^]/); });
});

describe('running the flight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const hooks = () => { const log = { camera: 0, wave: 0, say: [] as string[], end: 0 }; return { log, h: { camera: () => { log.camera++; }, wave: () => { log.wave++; }, say: (t: string) => { log.say.push(t); }, end: () => { log.end++; } } }; };
  it('plays to the end by itself and ends once', async () => {
    const { log, h } = hooks();
    runFlight(h, 17, 120);
    await vi.advanceTimersByTimeAsync(7000);
    expect(log.end).toBe(1);
    expect(log.camera).toBeGreaterThan(50);
    expect(log.say[0]).toMatch(/Step 1/);
    expect(log.say[log.say.length - 1]).toMatch(/Step 3/);
  });
  it('can be skipped, and skipping twice ends once', async () => {
    const { log, h } = hooks();
    const f = runFlight(h, 17, 120);
    await vi.advanceTimersByTimeAsync(1000);
    f.skip(); f.skip();
    await vi.advanceTimersByTimeAsync(7000);
    expect(log.end).toBe(1);
  });
  it('jumps straight to the end for reduced motion', () => {
    const { log, h } = hooks();
    runFlight(h, 17, 120, { reduced: true });
    expect(log.end).toBe(1);
    expect(log.say[log.say.length - 1]).toMatch(/Step 3/);
  });
  it('can be frozen at one second for a picture', async () => {
    const { log, h } = hooks();
    runFlight(h, 17, 120, { at: 2.5 });
    await vi.advanceTimersByTimeAsync(7000);
    expect(log.end).toBe(0);
    expect(log.camera).toBe(1);
    expect(log.say[0]).toMatch(/Step 2/);
  });
});

describe('picked buildings become separate pieces', () => {
  const sq = (x: number, z: number, w: number, h: number): Building => ({ ring: [[x, z], [x + w, z], [x + w, z + w], [x, z + w]], h, real: true });
  it('one piece per picked building, centred on its own middle', () => {
    const tops = buildingTops([sq(0, 0, 10, 12), sq(30, 0, 10, 20), sq(60, 20, 8, 9)], 0.5, null);
    const pieces = piecesFrom(tops, new Set([0, 2]), 0.5, null);
    expect(pieces.map((p) => p.name)).toEqual(['Building 1', 'Building 2']);
    expect(pieces[0].x).toBeCloseTo(2.5, 1); // the middle of a 10 m building at 0..10, shrunk by 0.5
    expect(pieces[0].z).toBeCloseTo(2.5, 1);
    expect(pieces[1].x).toBeCloseTo(32, 1);
    expect(pieces[1].z).toBeCloseTo(12, 1);
    for (const p of pieces) { expect(p.indices.length).toBeGreaterThan(0); expect(Math.min(...p.positions.filter((_, i) => i % 3 === 1))).toBeGreaterThanOrEqual(0); }
  });
  it('picking nothing gives nothing, picking everything gives everything', () => {
    const tops = buildingTops([sq(0, 0, 10, 12), sq(30, 0, 10, 20)], 0.5, null);
    expect(piecesFrom(tops, new Set(), 0.5, null)).toEqual([]);
    expect(piecesFrom(tops, new Set(tops.keys()), 0.5, null)).toHaveLength(2);
  });
  it('on a hill each piece keeps its own roof height', () => {
    const hill: Ground = { radius: 60, step: 20, n: 7, h: Array.from({ length: 49 }, (_, i) => 50 + 0.2 * (-60 + Math.floor(i / 7) * 20)) };
    const tops = buildingTops([sq(0, -50, 10, 12), sq(0, 40, 10, 12)], 0.5, hill);
    const [low, high] = piecesFrom(tops, new Set([0, 1]), 0.5, hill);
    const top = (p: { positions: number[] }) => Math.max(...p.positions.filter((_, i) => i % 3 === 1));
    expect(top(high)).toBeGreaterThan(top(low));
  });
  it('Montmartre: five picked buildings arrive as five pieces', () => {
    const answer = JSON.parse(readFileSync('tests/fixtures/overpass-montmartre.json', 'utf8')) as OverpassAnswer;
    const raw = JSON.parse(readFileSync('tests/fixtures/ground-montmartre.json', 'utf8')) as Ground;
    const tops = buildingTops(buildingsFrom(answer, 48.8867, 2.3431), 0.1, raw);
    const pieces = piecesFrom(tops, new Set([0, 3, 7, 12, 20]), 0.1, raw);
    expect(pieces).toHaveLength(5);
  });
});
