// The text-only Course Agent evaluation (CC-133, for the Best Agentic Use-Case bonus). Runs where the Baseten key lives (the laptop); the simulator tool runs on a VM over ssh.
// Every run starts from one sentence idea (no photo): the model proposes, the simulator tests, the model repairs, the loop stops at a proof or the step cap.
// Usage: npx tsx scripts/course-agent-text-eval.ts --tools "<ssh command that starts scripts/course-agent-tools-server.ts>" [--runs 2] [--parallel 4] [--only 3,5]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { askAgent } from '../functions/api/course-agent';
import { MODEL } from '../functions/api/designer';
import { runAgent, STEP_CAP, type AgentReport, type Ask, type Message } from '../src/slice/course-agent';
import type { Layout } from '../src/slice/layout-draft';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const toolsCmd = arg('tools', ''), runs = Number(arg('runs', '2')), parallel = Number(arg('parallel', '4')), only = arg('only', ''), outDir = arg('out', 'data/eval/cc-133-agent-text');
const PRICE = { in: 1.25, out: 4.25 }; // dollars per million tokens, as listed for Muse Spark Open on Baseten
const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key || !toolsCmd) throw new Error('need the key file and --tools');

// expect: the least number of each obstacle kind the idea asks for; minGap / minBarHeight keep a "too wide" trap honest; impossible: the ask cannot be met by design
export interface Idea { id: string; text: string; kind: 'normal' | 'trap' | 'impossible'; expect: { bar?: number; block?: number; gap?: number }; minGap?: number }
export const IDEAS: Idea[] = [
  { id: 'i01', text: 'a hard course with three monkey bars over water', kind: 'normal', expect: { bar: 3, gap: 1 } },
  { id: 'i02', text: 'an easy first course with a bench and a wall', kind: 'normal', expect: { block: 2 } },
  { id: 'i03', text: 'a park path with one stair step and then a handrail', kind: 'normal', expect: { block: 2 } },
  { id: 'i04', text: 'two low walls in a row', kind: 'normal', expect: { block: 2 } },
  { id: 'i05', text: 'one wide gap of 4 metres', kind: 'normal', expect: { gap: 1 }, minGap: 3.5 },
  { id: 'i06', text: 'a 12 metre gap with nothing to hang from', kind: 'impossible', expect: { gap: 1 }, minGap: 10 },
  { id: 'i07', text: 'a 3 metre high wall to climb over', kind: 'impossible', expect: { block: 1 } },
  { id: 'i08', text: 'five stair steps going up', kind: 'normal', expect: { block: 5 } },
  { id: 'i09', text: 'a 2 metre gap and then a bench', kind: 'normal', expect: { gap: 1, block: 1 }, minGap: 1.8 },
  { id: 'i10', text: 'a long flat run with nothing in the way', kind: 'normal', expect: {} },
  { id: 'i11', text: 'two bars with a 9 metre water gap between them', kind: 'trap', expect: { bar: 2, gap: 1 }, minGap: 8 },
  { id: 'i12', text: 'a 1.2 metre ledge followed by a 3 metre gap', kind: 'normal', expect: { block: 1, gap: 1 }, minGap: 2.7 },
  { id: 'i13', text: 'a playground with a low rail, a box and a bar', kind: 'normal', expect: { block: 2, bar: 1 } },
  { id: 'i14', text: 'the hardest course you can make that can still be cleared', kind: 'normal', expect: { bar: 1, block: 1, gap: 1 } },
  { id: 'i15', text: 'a school yard with a bench, a 1.5 metre wall and a puddle to jump', kind: 'normal', expect: { block: 2, gap: 1 } },
  { id: 'i16', text: 'a beginner course: one small step and one tiny gap', kind: 'normal', expect: { block: 1, gap: 1 } },
  { id: 'i17', text: 'a 2.5 metre wall and a 6 metre gap together', kind: 'trap', expect: { block: 1, gap: 1 }, minGap: 5 },
  { id: 'i18', text: 'four monkey bars in a row, 3 metres apart', kind: 'normal', expect: { bar: 4 } },
  { id: 'i19', text: 'a staircase of eight steps', kind: 'normal', expect: { block: 8 } },
  { id: 'i20', text: 'a 15 metre water gap with no bars', kind: 'impossible', expect: { gap: 1 }, minGap: 12 },
  { id: 'i21', text: 'a course with twelve different obstacles', kind: 'impossible', expect: { block: 1 } },
  { id: 'i22', text: 'a bar over a wide gap, then a box to vault', kind: 'normal', expect: { bar: 1, gap: 1, block: 1 } },
];

const proc = spawn('sh', ['-c', toolsCmd]);
proc.stderr.on('data', (d) => process.stderr.write(d));
const waiting = new Map<number, (r: AgentReport) => void>();
createInterface({ input: proc.stdout }).on('line', (l) => { try { const m = JSON.parse(l) as { id: number; report: AgentReport }; waiting.get(m.id)?.(m.report); waiting.delete(m.id); } catch { /* not a reply line */ } });
let seq = 0;
const test = (layout: Layout): Promise<AgentReport> => new Promise((resolve) => { const id = ++seq; waiting.set(id, resolve); proc.stdin.write(JSON.stringify({ id, layout }) + '\n'); });

const total = { in: 0, out: 0, calls: 0 };
const dollars = (t: { in: number; out: number }) => Math.round(((t.in * PRICE.in + t.out * PRICE.out) / 1e6) * 10000) / 10000;
async function modelCall(messages: Message[], u: { in: number; out: number; calls: number; ms: number }): Promise<string | null> {
  const t0 = Date.now();
  let usage = { in: 0, out: 0 };
  const spy: typeof fetch = async (url, init) => { const r = await fetch(url, init); try { const d = (await r.clone().json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }; usage = { in: d.usage?.prompt_tokens ?? 0, out: d.usage?.completion_tokens ?? 0 }; } catch { /* no body */ } return r; };
  let reply: string | null = null;
  try { const r = await askAgent(key!, { messages }, spy); reply = r.status === 200 ? r.body.reply ?? null : null; } catch { /* a failed call */ }
  u.ms += Date.now() - t0; u.calls++; total.calls++; u.in += usage.in; u.out += usage.out; total.in += usage.in; total.out += usage.out;
  return reply;
}

const count = (l: Layout | null, k: string) => (l ? l.items.filter((i) => i.kind === k).length : 0);
function meets(idea: Idea, l: Layout | null): { all: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const [k, n] of Object.entries(idea.expect)) if (count(l, k) < (n as number)) missing.push(`${k}: asked ${n}, final ${count(l, k)}`);
  const widest = l ? Math.max(0, ...l.items.filter((i) => i.kind === 'gap').map((i) => (i as { width: number }).width)) : 0;
  if (idea.minGap && widest < idea.minGap) missing.push(`widest gap: asked at least ${idea.minGap} m, final ${widest} m`);
  return { all: !missing.length, missing };
}

mkdirSync(`${outDir}/outputs`, { recursive: true });
const rows: Record<string, unknown>[] = [];
async function one(idea: Idea, run: number) {
  const id = `${idea.id}.run${run}`, u = { in: 0, out: 0, calls: 0, ms: 0 }, t0 = Date.now();
  const ask: Ask = (m) => modelCall(m, u);
  const result = await runAgent(ask, test, { cap: STEP_CAP, idea: idea.text });
  const m = meets(idea, result.layout), firstStep = result.steps[0];
  const row = {
    id, idea: idea.text, ideaKind: idea.kind, status: result.status, proven: result.status === 'cleared', steps: result.steps.length,
    clearedAtStep: result.status === 'cleared' ? result.steps.length : null, repairs: Math.max(0, result.steps.length - 1), clearedAtFirstTest: firstStep?.report.cleared ?? false,
    modelCalls: u.calls, tokensIn: u.in, tokensOut: u.out, dollars: dollars(u), seconds: Math.round((Date.now() - t0) / 100) / 10,
    obstaclesAsked: m.all ? 'all kept' : 'dropped or eased', missing: m.missing, finalObstacles: result.layout ? result.layout.items.filter((i) => i.kind !== 'ground').length : 0,
    clearedByDeleting: result.status === 'cleared' && !m.all, problems: result.problems,
  };
  rows.push(row);
  writeFileSync(`${outDir}/outputs/${id}.json`, JSON.stringify({ ...row, steps_: result.steps.map((s) => ({ n: s.n, kind: s.kind, say: s.say, layout: s.layout, report: s.report, words: s.words })), finalLayout: result.layout }, null, 2) + '\n');
  console.log(id, result.status, `steps ${row.steps}`, `calls ${row.modelCalls}`, `$${row.dollars}`, m.all ? 'asks kept' : `MISSING ${m.missing.join('; ')}`);
}

const picks = only ? IDEAS.filter((i) => only.split(',').includes(i.id.slice(1).replace(/^0/, '')) || only.split(',').includes(i.id)) : IDEAS;
const jobs = picks.flatMap((i) => Array.from({ length: runs }, (_, r) => [i, r + 1] as const));
let next = 0;
await Promise.all(Array.from({ length: parallel }, async () => { while (next < jobs.length) { const [i, r] = jobs[next++]; try { await one(i, r); } catch (e) { console.error('run failed', i.id, r, String(e).slice(0, 120)); } } }));
proc.stdin.end();
const rs = rows as unknown as { proven: boolean; steps: number; clearedAtStep: number | null; modelCalls: number; tokensIn: number; tokensOut: number; dollars: number; clearedByDeleting: boolean; ideaKind: string; status: string }[];
const by = (k: string) => rs.filter((r) => r.ideaKind === k);
const summary = { runs: rs.length, proven: rs.filter((r) => r.proven).length, provenAtFirstTest: rs.filter((r) => r.clearedAtStep === 1).length, provenAfterRepair: rs.filter((r) => (r.clearedAtStep ?? 0) > 1).length, notProvenAtCap: rs.filter((r) => r.status === 'not-cleared').length, noLayout: rs.filter((r) => r.status === 'no-layout').length, meanSteps: Math.round((rs.reduce((s, r) => s + r.steps, 0) / Math.max(1, rs.length)) * 100) / 100, maxSteps: Math.max(0, ...rs.map((r) => r.steps)), modelCalls: rs.reduce((s, r) => s + r.modelCalls, 0), tokensIn: total.in, tokensOut: total.out, dollars: dollars(total), clearedByDeleting: rs.filter((r) => r.clearedByDeleting).length, byKind: Object.fromEntries(['normal', 'trap', 'impossible'].map((k) => [k, { runs: by(k).length, proven: by(k).filter((r) => r.proven).length, clearedByDeleting: by(k).filter((r) => r.clearedByDeleting).length }])) };
rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
writeFileSync(`${outDir}/results.json`, JSON.stringify({ summary, rows }, null, 2) + '\n');
writeFileSync(`${outDir}/run.json`, JSON.stringify({ experiment: 'cc-133-agent-text', issue: 'CC-133', model: MODEL, stepCap: STEP_CAP, startedFrom: 'one sentence idea, no photo', path: 'functions/api/course-agent.ts + src/slice/course-agent.ts loop + src/slice/course-agent-tools.ts simulator (not wired to the editor button)', toolsRunOn: 'a Vultr VM over ssh', modelCallsFrom: 'the laptop', price: PRICE, ideas: picks.length, runsPerIdea: runs, tokens: total, totalDollars: dollars(total), date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
