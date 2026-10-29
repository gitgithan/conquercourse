import { describe, expect, it } from 'vitest';
import { runAgent, STEP_CAP, reportWords, type AgentReport, type Ask, type Test } from '../src/slice/course-agent';
import { testLayout, itemAt } from '../src/slice/course-agent-tools';
import type { Layout } from '../src/slice/photo-course';

const reply = (l: Layout, say = 'Here is a course.') => `${say}\n\`\`\`json\n${JSON.stringify(l)}\n\`\`\``;
const flat: Layout = { items: [{ kind: 'ground', length: 6 }, { kind: 'block', length: 2, height: 0.3 }, { kind: 'ground', length: 6 }] };
const wall: Layout = { items: [{ kind: 'ground', length: 6 }, { kind: 'block', length: 2, height: 1.8 }, { kind: 'ground', length: 6 }] };
const rep = (over: Partial<AgentReport> = {}): AgentReport => ({ cleared: false, seconds: null, jumps: 0, stoppedAtItem: 1, reachedMetres: 5, laneMetres: 14, probes: [], ...over });

describe('the Course Agent loop', () => {
  it('stops at the first proof', async () => {
    let calls = 0;
    const ask: Ask = async () => { calls++; return reply(flat); };
    const test: Test = () => rep({ cleared: true, seconds: 4, jumps: 0 });
    const r = await runAgent(ask, test);
    expect(r.status).toBe('cleared');
    expect(r.steps).toHaveLength(1);
    expect(calls).toBe(1);
  });
  it('repairs from the report, and the repair prompt carries what the simulator said', async () => {
    const seen: string[] = [];
    let n = 0;
    const ask: Ask = async (m) => { seen.push(m[m.length - 1].content); return reply(n++ === 0 ? wall : flat); };
    const test: Test = (l) => (l === undefined || JSON.stringify(l) === JSON.stringify(wall) ? rep({ probes: [{ item: 1, text: 'item 2 (block) 1.8 m high lowered to 0.9 m', clears: true, seconds: 5 }] }) : rep({ cleared: true, seconds: 4 }));
    const r = await runAgent(ask, test);
    expect(r.status).toBe('cleared');
    expect(r.steps.map((s) => s.kind)).toEqual(['proposed', 'repaired']);
    expect(seen[1]).toContain('lowered to 0.9 m');
    expect(seen[1]).toContain('block 2 m long, 1.8 m high');
  });
  it('stops at the cap and hands back the best tested attempt, never an untested layout', async () => {
    let n = 0;
    const ask: Ask = async () => reply({ items: [{ kind: 'ground', length: 6 }, { kind: 'block', length: 2 + n++, height: 0.3 }, { kind: 'ground', length: 6 }] });
    const reached = [3, 9, 6, 2, 4, 1, 8];
    let t = 0;
    const tested: string[] = [];
    const test: Test = (l) => { tested.push(JSON.stringify(l)); return rep({ reachedMetres: reached[t++] }); };
    const r = await runAgent(ask, test);
    expect(r.status).toBe('not-cleared');
    expect(r.steps).toHaveLength(STEP_CAP);
    expect(r.report?.reachedMetres).toBe(9);
    expect(tested).toContain(JSON.stringify(r.layout));
  });
  it('survives a model that fails or answers without a layout, and gives up honestly', async () => {
    const r1 = await runAgent(async () => null, () => rep());
    expect(r1.status).toBe('no-layout');
    expect(r1.problems.length).toBeGreaterThan(0);
    const r2 = await runAgent(async () => 'I think it looks like a park.', () => rep());
    expect(r2.status).toBe('no-layout');
  });
  it('recovers when one answer is bad and the next is good', async () => {
    const answers = ['no json here', reply(flat)];
    const r = await runAgent(async () => answers.shift() ?? null, () => rep({ cleared: true, seconds: 3 }));
    expect(r.status).toBe('cleared');
    expect(r.problems).toHaveLength(1);
  });
  it('can start from a stored first draft and spends its first step on testing it', async () => {
    let asked = 0;
    const r = await runAgent(async () => { asked++; return reply(flat); }, (l) => rep({ cleared: JSON.stringify(l) === JSON.stringify(flat), seconds: 4 }), { startFrom: { layout: wall, say: 'A wall.' } });
    expect(r.steps[0].kind).toBe('proposed');
    expect(r.status).toBe('cleared');
    expect(asked).toBe(1);
  });
  it('says the result in plain words, without formulas', () => {
    expect(reportWords(rep({ cleared: true, seconds: 4.2, jumps: 2 }), flat)).toBe('Cleared in 4.2 s on the best line, with 2 jumps.');
    const w = reportWords(rep({ stoppedAtItem: 1, probes: [{ item: 1, text: 'item 2 (block) 1.8 m high lowered to 0.9 m', clears: true, seconds: 5 }] }), wall);
    expect(w).toContain('stopped at item 2, block 2 m long, 1.8 m high');
    expect(w).toContain('would clear it');
  });
});

describe('the simulator tool', () => {
  it('proves a flat lane clears and says how long the best line takes', () => {
    const r = testLayout(flat);
    expect(r.cleared).toBe(true);
    expect(r.seconds).toBeGreaterThan(2);
    expect(r.stoppedAtItem).toBeNull();
  });
  it('finds the obstacle a failed run stopped at, and proves an easing that clears', () => {
    const r = testLayout(wall);
    expect(r.cleared).toBe(false);
    expect(r.stoppedAtItem).toBe(1);
    expect(r.probes.length).toBeGreaterThan(0);
    expect(r.probes[0].item).toBe(1);
  });
  it('gives the same answer twice', () => {
    expect(testLayout(wall)).toEqual(testLayout(wall));
  });
  it('maps a position to the next obstacle', () => {
    expect(itemAt(wall, 2)).toBe(1);
    expect(itemAt(wall, 7.5)).toBe(1);
    expect(itemAt(wall, 9)).toBe(-1);
  });
});
