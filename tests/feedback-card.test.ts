import { describe, expect, it } from 'vitest';
import { KINDS, KIND_INFO, LIMITS, CONTEXT_KEYS, WHY_CHIPS, asksClear, browserName, buildContext, buildPayload, canSend, emptyState, screenKey, screenLabel, sentLines, noteRunning, isRunning, onRunningChange } from '../src/ui/feedback-model';
import { onRequestPost } from '../functions/api/submit';
import { groupQuick, renderQuick } from '../scripts/feedback-group.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const facts = (mode = 'course', q = '') => ({ mode, params: new URLSearchParams(q), ua: UA, width: 1280, height: 720 });
const OPT = { session: 'abcdef12-3456', build: 'abc 2026-11-01', mode: 'course' };

describe('feedback form model', () => {
  it('has a different question for each kind', () => {
    expect(new Set(KINDS.map((k) => KIND_INFO[k].prompt)).size).toBe(KINDS.length);
    expect(KIND_INFO.broke.prompt).toMatch(/press/i);
  });
  it('fills in the screen, window and world, and names the browser without the raw agent string', () => {
    const items = buildContext(facts('course', 'course=/assets/demo/training.course.json&rk=b'));
    const m = Object.fromEntries(items.map((i) => [i.key, i.value]));
    expect(m.screen).toBe('Course');
    expect(m.window).toBe('1280 x 720');
    expect(m.world).toBe('demo/training');
    expect(m.character).toBe('Rookie B');
    expect(m.browser).toBe('Chrome 130 on Linux');
    expect(JSON.stringify(items)).not.toContain('Mozilla');
    expect(items.every((i) => i.on)).toBe(true);
  });
  it('adds the last run and a seed only when there is one', () => {
    expect(buildContext(facts()).some((i) => i.key === 'last_run')).toBe(false);
    const m = Object.fromEntries(buildContext(facts('course', 'generate=42'), { lastRun: 'Cleared at 12.4 s' }).map((i) => [i.key, i.value]));
    expect(m.last_run).toBe('Cleared at 12.4 s');
    expect(m.replay).toBe('seed 42');
  });
  it('names every screen and asks "Was this clear?" on the learning and making screens', () => {
    expect(screenLabel('map')).toBe('World Slicer');
    expect(screenLabel('lab-ik')).toBe('Lab: ik');
    for (const m of ['course', 'dojo', 'editor', 'map', 'parts', 'lab-rl']) expect(asksClear(m)).toBe(true);
    expect(asksClear('welcome')).toBe(false);
    expect(screenKey('lab-rl')).toBe('labs');
  });
  it('sends only what is ticked, and only the allowed keys', () => {
    const ctx = buildContext(facts('course', 'rk=a'));
    ctx.find((c) => c.key === 'browser')!.on = false;
    const st = { ...emptyState(ctx, 'Course'), kind: 'broke' as const, text: 'x'.repeat(5000), rating: 4, clear: 'no' as const, why: WHY_CHIPS[0] };
    const p = buildPayload(st, OPT);
    expect(p.context.browser).toBeUndefined();
    expect(Object.keys(p.context).every((k) => (CONTEXT_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(p.answers.text).toHaveLength(LIMITS.text);
    expect(p.answers.why).toBe(WHY_CHIPS[0]);
    expect(Object.keys(p.answers).sort()).toEqual(['clear', 'kind', 'rating', 'text', 'where', 'why']);
  });
  it('carries no personal field and no raw agent, address or name', () => {
    const p = JSON.stringify(buildPayload({ ...emptyState(buildContext(facts()), 'Course'), kind: 'idea', text: 'more bars' }, OPT));
    for (const bad of ['email', 'name"', 'ip"', 'Mozilla', 'userAgent', 'cookie']) expect(p).not.toContain(bad);
    expect(Object.keys(JSON.parse(p)).sort()).toEqual(['answers', 'build', 'context', 'mode', 'round', 'session', 'v', 'website']);
  });
  it('drops "why" unless the answer was Not really', () => {
    const p = buildPayload({ ...emptyState([], 'x'), clear: 'yes', why: WHY_CHIPS[1] }, OPT);
    expect(p.answers.why).toBeUndefined();
  });
  it('lets an empty form stay unsent and shows exactly what goes', () => {
    expect(canSend(emptyState([], ''))).toBe(false);
    expect(canSend({ ...emptyState([], ''), rating: 3 })).toBe(true);
    const lines = sentLines(buildPayload({ ...emptyState(buildContext(facts()), 'Course'), kind: 'loved' }, OPT));
    expect(lines).toContain('kind: loved');
    expect(lines.some((l) => l.startsWith('screen: Course'))).toBe(true);
  });
  it('reads browser names', () => {
    expect(browserName('Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox 131 on Windows');
  });
  it('tells listeners when a run starts and stops', () => {
    let n = 0; const off = onRunningChange(() => n++);
    noteRunning(true); noteRunning(true); noteRunning(false);
    expect(n).toBe(2); expect(isRunning()).toBe(false); off();
  });
});

function fakeDb(recent = 0) {
  const rows: unknown[][] = [];
  return { rows, db: { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({ run: async () => { rows.push(v); return {}; }, first: async () => (sql.startsWith('SELECT') ? { n: recent } : null) }) }) } };
}
const post = async (body: unknown, recent = 0) => {
  const { db, rows } = fakeDb(recent);
  const r = await onRequestPost({ request: new Request('https://x/api/submit', { method: 'POST', body: JSON.stringify(body) }), env: { DB: db } as never });
  return { status: r.status, rows };
};
const good = () => buildPayload({ ...emptyState(buildContext(facts('course', 'rk=a'), { lastRun: 'Fell at 3.0 s' }), 'Course: training'), kind: 'broke', text: 'I pressed jump', rating: 2, clear: 'no', why: 'Too fast' }, OPT);

describe('feedback endpoint, new card', () => {
  it('stores a good note in the existing columns', async () => {
    const r = await post(good());
    expect(r.status).toBe(200);
    expect(r.rows[0][0]).toBe('quick-1');
    expect(JSON.parse(String(r.rows[0][4])).kind).toBe('broke');
    expect(JSON.parse(String(r.rows[0][5])).last_run).toBe('Fell at 3.0 s');
  });
  it('turns away a bad kind, rating, chip or empty note', async () => {
    expect((await post({ ...good(), answers: { kind: 'hax' } })).status).toBe(400);
    expect((await post({ ...good(), answers: { rating: 9 } })).status).toBe(400);
    expect((await post({ ...good(), answers: { clear: 'no', why: 'because' } })).status).toBe(400);
    expect((await post({ ...good(), answers: {} })).status).toBe(400);
  });
  it('clips text, drops unknown context keys, removes emails and links', async () => {
    const r = await post({ ...good(), answers: { kind: 'idea', text: 'mail me a' + '@' + 'b.example see https://x.y/z ' + 'q'.repeat(3000) }, context: { screen: 'Course', ip: ['1', '2', '3', '4'].join('.'), name: 'Sam' } });
    expect(r.status).toBe(200);
    {
      const a = JSON.parse(String(r.rows[0][4])), c = JSON.parse(String(r.rows[0][5]));
      expect(a.text).not.toContain('a' + '@' + 'b.example'); expect(a.text).not.toContain('https'); expect(a.text.length).toBeLessThanOrEqual(LIMITS.text);
      expect(Object.keys(c)).toEqual(['screen']);
    }
  });
  it('still limits a session to five an hour and keeps the old form working', async () => {
    expect((await post(good(), 5)).status).toBe(429);
    const old = await post({ round: 'public-5', session: 'abcdef12-3456', build: 'b', mode: 'course', answers: { clear: 4 }, context: { falls: 1 } });
    expect(old.status).toBe(200); expect(old.rows[0][0]).toBe('public-5');
  });
});

describe('feedback reader', () => {
  const rows = [
    { round: 'quick-1', mode: 'course', build: 'b1', answers: { kind: 'broke', text: 'froze', rating: 2, clear: 'no', why: 'Too fast' }, context: { screen: 'Course' } },
    { round: 'quick-1', mode: 'dojo', build: 'b1', answers: { kind: 'idea', text: 'more', clear: 'yes' }, context: { screen: 'Dojo' } },
    { round: 'public-5', mode: 'course', build: 'b0', answers: { clear: 4 }, context: {} },
  ];
  it('groups by kind and screen and leaves old rows apart', () => {
    const g = groupQuick(rows);
    expect(g.total).toBe(2); expect(g.old).toBe(1);
    expect(g.byKind.broke).toHaveLength(1);
    expect(g.screens.Course.why['Too fast']).toBe(1);
    expect(renderQuick(rows)).toContain('## Something broke (1)');
  });
});
