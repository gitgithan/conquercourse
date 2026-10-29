import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMOS, WORD_VALUES } from '../src/ui/world-picker';
import { hasPath, nearestReady, shownReady, type PlaceLane, type ReadyIndexEntry } from '../src/world/places';
import { playPlan } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';
import { onRequestPost as community, hasPath as boxesHavePath } from '../functions/api/community';
import { onRequestPost as courseEvent, PROVEN_KEY } from '../functions/api/course-event';

// CC-211: nothing is offered or saved unless the simulator has a path through it.
const index = JSON.parse(readFileSync('public/assets/places/index.json', 'utf8')) as ReadyIndexEntry[];

describe('every place the picker can offer has a proven path (data-driven)', () => {
  it('the index has places, and what the list shows is exactly the places with a path', () => {
    expect(index.length).toBeGreaterThan(10);
    const shown = shownReady(index, false, true);
    expect(shown.length).toBeGreaterThan(10);
    for (const p of shown) expect(hasPath(p), p.slug).toBe(true);
  });
  for (const e of index) {
    it(`${e.slug}: the flag in the index equals the lane the simulator cleared in the place file`, () => {
      const lane = (JSON.parse(readFileSync(`public/assets/places/${e.slug}.json`, 'utf8')) as { lane: PlaceLane | null }).lane;
      expect(Boolean(lane?.cleared), 'run scripts/places-list.ts').toBe(e.path === true);
      if (e.listed !== false) expect(lane?.cleared, `${e.slug} is listed without a path`).toBe(true);
    });
  }
  it('a place without a path is never listed, snapped to or shown with ?places=all in the new screen', () => {
    const fake: ReadyIndexEntry = { slug: 'fake', name: 'Fake', lat: 1, lon: 1, radius: 120, hill_m: 0, buildings: 9, bytes: 1, blurb: '', path: false, listed: true };
    const all = [...index, fake];
    expect(shownReady(all, false, true).some((p) => p.slug === 'fake')).toBe(false);
    expect(shownReady(all, true, true).some((p) => p.slug === 'fake')).toBe(false);
    expect(shownReady(all, true, false).some((p) => p.slug === 'fake')).toBe(true); // the old screen and the debug switch
    expect(nearestReady(all.filter(hasPath), 1, 1)).toBeNull();
  });
});

describe('every course the picker offers is cleared by its stored best line', () => {
  const courses = DEMOS.filter(([v]) => !WORD_VALUES.includes(v) && v !== '');
  it('there are courses to check', () => expect(courses.length).toBeGreaterThan(8));
  for (const [v, label] of courses) {
    it(`${label}`, () => {
      const c = JSON.parse(readFileSync(`public${v}`, 'utf8')) as CourseData;
      expect(c.plan, 'no stored best line').toBeDefined();
      expect(playPlan(c, c.plan!, 120 * 120).world.outcome, 'the stored best line no longer clears it').toBe('cleared');
    });
  }
});

describe('the servers save nothing without a path', () => {
  const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
  const base = { session: 'abcdef12-3456', name: 'Library steps', nick: 'sam', confirm: true, width: 800, height: 600, image: jpeg };
  const db = () => { const ins: unknown[] = []; return { ins, env: { DB: { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({ run: async () => { if (sql.startsWith('INSERT')) ins.push(v); return {}; }, first: async () => ({ n: 0 }), all: async () => ({ results: [] }) }) }) } } as never }; };
  const send = async (body: unknown) => { const d = db(); const r = await community({ request: new Request('https://x/api/community', { method: 'POST', body: JSON.stringify(body) }), env: d.env }); return { status: r.status, ins: d.ins }; };
  it('a community course the simulator can clear is stored', async () => {
    const r = await send({ ...base, boxes: [{ phrase: 'steps', box: [100, 300, 400, 420], heightM: 0.6 }, { phrase: 'wall', box: [450, 250, 700, 400] }] });
    expect(r).toEqual({ status: 200, ins: expect.any(Array) });
    expect(r.ins.length).toBe(1);
  });
  it('a course the proof cannot even build is not a path', () => {
    expect(boxesHavePath([], 'x')).toBe(false);
  });
  it('a run event is saved only for a stored course or a generated seed', async () => {
    const sent = async (courseKey: string) => { const d = db(); const r = await courseEvent({ request: new Request('https://x/api/course-event', { method: 'POST', body: JSON.stringify({ session: 'abcdef12-3456', runId: 'abcdef12-0001', event: 'start', courseKey }) }), env: d.env }); return { body: await r.json() as { skipped?: string }, saved: d.ins.length }; };
    expect((await sent('demo/lache')).saved).toBe(1);
    expect((await sent('generated-7')).saved).toBe(1);
    for (const k of ['coaster-custom', 'my-course', 'unnamed-course']) { const r = await sent(k); expect(r.saved, k).toBe(0); expect(r.body.skipped).toBeDefined(); }
    expect(PROVEN_KEY.test('experiments/osm/montmartre-paris')).toBe(true);
  });
  it('the place builder writes no place whose lane the simulator did not clear', () => {
    expect(readFileSync('scripts/make-places.ts', 'utf8')).toMatch(/if \(!lane\?\.cleared\)[^\n]*continue/);
  });
});
