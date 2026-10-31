// The Course Agent evaluation (CC-127 / CC-126). Runs where the Baseten key lives; the simulator tool runs on a VM over ssh (--tools "ssh user@host 'cd dir && node_modules/.bin/tsx scripts/course-agent-tools-server.ts'")
// or locally (--tools local). Two parts, each saved under data/eval/cc-126-course-agent/:
//   paired: start from the 20 saved one-shot drafts of the photo-course experiment (CC-52), so any gain is the repair loop alone.
//   fresh:  one end-to-end run per photo (the agent proposes from the photo, then repairs).
// Usage: npx tsx scripts/course-agent-eval.ts [--part paired|fresh|both] [--tools local|"<ssh command>"] [--max-tokens 300000] [--runs-fresh 1]
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { askAgent } from '../functions/api/course-agent';
import { MODEL } from '../functions/api/designer';
import { drift, obstacleCount, runAgent, STEP_CAP, type AgentReport, type Ask, type Message } from '../src/slice/course-agent';
import { parseLayout, type Layout } from '../src/slice/layout-draft';

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const part = arg('part', 'both'), toolsCmd = arg('tools', 'local'), maxTokens = Number(arg('max-tokens', '300000')), freshRuns = Number(arg('runs-fresh', '1'));
const PRICE = { in: 1.25, out: 4.25 }; // dollars per million tokens (Muse Spark Open on Baseten, as listed); the hackathon credits cover it
const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no key file');

const base = 'data/eval/photo-course', out = 'data/eval/cc-126-course-agent';
mkdirSync(`${out}/outputs`, { recursive: true });
const answerKey = JSON.parse(readFileSync(`${base}/answer-key.json`, 'utf8')) as { photos: Record<string, { file: string; items: Layout['items'] }> };
const baseline = JSON.parse(readFileSync(`${base}/results.json`, 'utf8')) as { rows: { photo: string; run: number; clearsAsDrawn: boolean; clearsAfterFixIt: boolean; said: string; layout: unknown }[] };

// ---- the tool: a line server (local or over ssh)
let proc: ChildProcessWithoutNullStreams;
if (toolsCmd === 'local') proc = spawn('node_modules/.bin/tsx', ['scripts/course-agent-tools-server.ts']);
else proc = spawn('sh', ['-c', toolsCmd]);
proc.stderr.on('data', (d) => process.stderr.write(d));
const waiting = new Map<number, (r: AgentReport) => void>();
createInterface({ input: proc.stdout }).on('line', (l) => { try { const m = JSON.parse(l) as { id: number; report: AgentReport }; waiting.get(m.id)?.(m.report); waiting.delete(m.id); } catch { /* not a reply line */ } });
let seq = 0;
const test = (layout: Layout): Promise<AgentReport> => new Promise((resolve) => { const id = ++seq; waiting.set(id, resolve); proc.stdin.write(JSON.stringify({ id, layout }) + '\n'); });

// ---- the model: the same function the site uses, called directly
const tokens = { in: 0, out: 0, calls: 0 };
const small = join(tmpdir(), 'cc127-small.jpg');
const photoUrl = (id: string): string => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', answerKey.photos[id].file, '-vf', "scale='min(768,iw)':-2", '-q:v', '4', small]); return `data:image/jpeg;base64,${readFileSync(small).toString('base64')}`; };
const dollars = (t: { in: number; out: number }) => Math.round(((t.in * PRICE.in + t.out * PRICE.out) / 1e6) * 1000) / 1000;

async function modelCall(image: string | null, messages: Message[], run: { in: number; out: number; calls: number; ms: number }): Promise<string | null> {
  if (tokens.in + tokens.out > maxTokens) throw new Error('token budget reached');
  const t0 = Date.now();
  const res = await fetchWithUsage(image, messages);
  run.ms += Date.now() - t0; run.calls++; tokens.calls++;
  run.in += res.usage.in; run.out += res.usage.out; tokens.in += res.usage.in; tokens.out += res.usage.out;
  return res.reply;
}
// askAgent returns only the reply; wrap fetch to read the usage block off the same response without printing the key
async function fetchWithUsage(image: string | null, messages: Message[]): Promise<{ reply: string | null; usage: { in: number; out: number } }> {
  let usage = { in: 0, out: 0 };
  const spy: typeof fetch = async (u, init) => { const r = await fetch(u, init); const c = r.clone(); try { const d = (await c.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }; usage = { in: d.usage?.prompt_tokens ?? 0, out: d.usage?.completion_tokens ?? 0 }; } catch { /* no body */ } return r; };
  try { const r = await askAgent(key!, image ? { image, messages } : { messages }, spy); return { reply: r.status === 200 ? r.body.reply ?? null : null, usage }; } catch { return { reply: null, usage }; }
}

interface Row { id: string; part: string; photo: string; run: number; startedFrom: string; status: string; steps: number; clearedAtStep: number | null; tokensIn: number; tokensOut: number; dollars: number; calls: number; seconds: number; obstaclesKept: number | null; keyObstacles: number; drift: ReturnType<typeof drift>; stepsDetail: unknown; problems: string[] }
const rows: Row[] = [];

async function one(partName: string, photo: string, run: number, start: { layout: Layout; say: string } | null, baselineClear: boolean | null): Promise<void> {
  const id = `${partName}.${photo}.run${run}`;
  const usage = { in: 0, out: 0, calls: 0, ms: 0 };
  const t0 = Date.now();
  let image: string | null = null;
  const ask: Ask = async (messages: Message[]) => {
    const first = messages.length === 1 && messages[0].content.startsWith('Here is the photo');
    if (first && !image) image = photoUrl(photo);
    return modelCall(first ? image : null, messages, usage);
  };
  const result = await runAgent(ask, test, { cap: STEP_CAP, ...(start ? { startFrom: start } : {}) });
  const key_ = answerKey.photos[photo].items as Layout['items'];
  const row: Row = {
    id, part: partName, photo, run, startedFrom: start ? 'saved one-shot draft' : 'the photo', status: result.status, steps: result.steps.length,
    clearedAtStep: result.status === 'cleared' ? result.steps.length : null, tokensIn: usage.in, tokensOut: usage.out, dollars: dollars(usage), calls: usage.calls,
    seconds: Math.round((Date.now() - t0) / 100) / 10, obstaclesKept: result.layout ? obstacleCount(result.layout) : null, keyObstacles: key_.filter((i) => i.kind !== 'ground').length,
    drift: drift(result.layout, { items: key_ }), problems: result.problems,
    stepsDetail: result.steps.map((s) => ({ n: s.n, kind: s.kind, say: s.say, layout: s.layout, report: s.report, words: s.words })),
  };
  rows.push(row);
  writeFileSync(`${out}/outputs/${id}.json`, JSON.stringify({ ...row, baselineClearedAsDrawn: baselineClear, finalLayout: result.layout }, null, 2) + '\n');
  console.log(id, result.status, `steps ${row.steps}`, `${row.tokensIn + row.tokensOut} tokens`, `$${row.dollars}`, `kept ${row.obstaclesKept}/${row.keyObstacles}`);
}

try {
  if (part === 'paired' || part === 'both') {
    for (const b of baseline.rows) {
      const raw = JSON.parse(readFileSync(`${base}/outputs/${b.photo}.run${b.run}.json`, 'utf8')) as { reply: string };
      const parsed = parseLayout(raw.reply);
      await one('paired', b.photo, b.run, parsed.layout ? { layout: parsed.layout, say: parsed.text } : null, b.clearsAsDrawn);
    }
  }
  if (part === 'fresh' || part === 'both') {
    for (const photo of Object.keys(answerKey.photos)) for (let r = 1; r <= freshRuns; r++) await one('fresh', photo, r, null, null);
  }
} finally {
  proc.stdin.end();
  const sum = (p: string) => { const rs = rows.filter((r) => r.part === p); return { runs: rs.length, cleared: rs.filter((r) => r.status === 'cleared').length, clearedAtStep1: rs.filter((r) => r.clearedAtStep === 1).length, clearedAfterRepair: rs.filter((r) => (r.clearedAtStep ?? 0) > 1).length, noLayout: rs.filter((r) => r.status === 'no-layout').length, meanSteps: Math.round((rs.reduce((s, r) => s + r.steps, 0) / Math.max(1, rs.length)) * 10) / 10, tokensIn: rs.reduce((s, r) => s + r.tokensIn, 0), tokensOut: rs.reduce((s, r) => s + r.tokensOut, 0), dollars: Math.round(rs.reduce((s, r) => s + r.dollars, 0) * 1000) / 1000, keptAllObstaclesOfKey: rs.filter((r) => r.status === 'cleared' && r.obstaclesKept !== null && r.obstaclesKept >= r.keyObstacles).length, clearedWithFewerObstaclesThanKey: rs.filter((r) => r.status === 'cleared' && r.obstaclesKept !== null && r.obstaclesKept < r.keyObstacles).length }; };
  const summary = { paired: sum('paired'), fresh: sum('fresh') };
  writeFileSync(`${out}/results.${part}.json`, JSON.stringify({ summary, rows: rows.map(({ stepsDetail: _s, ...r }) => r) }, null, 2) + '\n');
  writeFileSync(`${out}/run.${part}.json`, JSON.stringify({ experiment: 'cc-126-course-agent', issue: 'CC-127', model: MODEL, stepCap: STEP_CAP, part, toolsRunOn: toolsCmd === 'local' ? 'this machine' : 'a Vultr VM over ssh', price: PRICE, tokens, totalDollars: dollars(tokens), startedFrom: 'data/eval/photo-course (CC-52) outputs and answer key', date: new Date().toISOString().slice(0, 10), baseline: { runs: 20, clearsAsDrawn: 13, afterFixIt: 13, afterDroppingBars: 15 } }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2), 'total $', dollars(tokens));
  if (!existsSync(`${out}/results.${part}.json`)) process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
