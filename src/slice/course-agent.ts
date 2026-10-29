import { parseLayout, scoreLayout, type Item, type Layout, type Score } from './photo-course';

// The Course Agent: one photo in, a course the simulator has proved out. Muse Spark Open proposes a layout; the simulator is the tool the loop
// calls (can it be cleared? where does the best attempt stop? which small easing clears it?); the model repairs the layout from that report,
// and the loop stops at the first proof, or at the step cap with the best attempt it tested. This file is pure: the model call and the tool
// are handed in, so the same loop runs in the browser, in the worker and in the eval script.
export const STEP_CAP = 6; // one proposal and up to five repairs

export const itemLength = (it: Item): number => (it.kind === 'ground' ? it.length : it.kind === 'gap' ? it.width : it.kind === 'block' ? it.length : 0);

export interface Probe { item: number; text: string; clears: boolean; seconds: number | null }
export interface AgentReport {
  cleared: boolean;
  seconds: number | null; // the best line's time when cleared
  jumps: number;
  stoppedAtItem: number | null; // 0-based index of the obstacle the best attempt stopped at
  reachedMetres: number;
  laneMetres: number;
  probes: Probe[]; // single easings the simulator proved clear the course
}

export type Message = { role: 'user' | 'assistant'; content: string };
export type Ask = (messages: Message[]) => Promise<string | null>; // null: the model call failed
export type Test = (layout: Layout) => Promise<AgentReport> | AgentReport;

export interface Step {
  n: number;
  kind: 'proposed' | 'repaired';
  say: string; // the model's one plain sentence
  layout: Layout;
  report: AgentReport;
  words: string; // the trace line the player reads
}
export interface AgentResult {
  status: 'cleared' | 'not-cleared' | 'no-layout';
  layout: Layout | null; // the cleared layout, or the best tested attempt; never one the simulator has not seen
  report: AgentReport | null;
  steps: Step[];
  problems: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const describeItem = (it: Item, i: number): string => `${i + 1}. ${it.kind === 'ground' ? `ground ${it.length} m` : it.kind === 'gap' ? `gap ${it.width} m` : it.kind === 'block' ? `block ${it.length} m long, ${it.height} m high` : `bar ${it.height} m up`}`;

export const AGENT_SYSTEM = [
  'You build a first course for a ninja-warrior physics game from a photo of a real park, then fix it until a simulator proves it can be cleared.',
  'A runner goes left to right along a 2 m wide lane. Reply with one short plain sentence, then one fenced ```json block holding {"items": [...]}, items in the order the runner meets them.',
  'Item kinds (all sizes in metres): {"kind":"ground","length":m}, {"kind":"gap","width":m} (a drop or water gap to be jumped), {"kind":"block","length":m,"height":m} (anything raised: step, stairs, ledge, box, bench, rail, low wall), {"kind":"bar","height":m} (a bar to hang from, height above the ground).',
  'Start and end with ground. At most 10 items. Estimate sizes from things you know (a stair step is 0.15 to 0.18 m, a handrail 0.9 m, a bench seat 0.45 m, a door 2 m).',
  'After each try the simulator tells you the result: whether the best run cleared it, where the best attempt stopped, and any single change it proved would clear the course.',
  'When a try fails, repair the layout using that report: change sizes or gaps where it points, keep every obstacle the photo shows, and drop at most one obstacle or bar only if nothing else works, saying so in your sentence.',
  'Reply with the whole new layout each time. Never describe or judge any person in the photo. Never show formulas.',
].join(' ');

export function firstAsk(): string {
  return 'Here is the photo. Propose the first course.';
}

export function reportWords(r: AgentReport, layout: Layout): string {
  if (r.cleared) return `Cleared in ${r1(r.seconds ?? 0)} s on the best line, with ${r.jumps} jump${r.jumps === 1 ? '' : 's'}.`;
  const at = r.stoppedAtItem === null || r.stoppedAtItem < 0 ? null : r.stoppedAtItem;
  const head = at === null ? `Not cleared: the best attempt reached ${r1(r.reachedMetres)} m of ${r1(r.laneMetres)} m.` : `Not cleared: the best attempt stopped at ${describeItem(layout.items[at], at).replace(/^(\d+)\. /, 'item $1, ')} (${r1(r.reachedMetres)} m in).`;
  return r.probes.length ? `${head} The simulator proved these single changes would clear it: ${r.probes.map((p) => p.text).join('; ')}.` : `${head} No single easing of one obstacle clears it.`;
}

// What the model is told after a try: the layout it made, in numbered items, and the simulator's report.
export function repairAsk(layout: Layout, r: AgentReport, firstSay: string): string {
  return [
    firstSay ? `Your first sentence was: ${firstSay}` : '',
    `Your layout:\n${layout.items.map(describeItem).join('\n')}`,
    `Simulator report: ${reportWords(r, layout)}`,
    'Fix the layout so the best run clears it. Reply with one short sentence and the whole new layout as a json block.',
  ].filter(Boolean).join('\n');
}

// "Better" among failed tries: the one whose best attempt got farthest along a lane of the same make, with a single-change fix as a tie-break.
const progress = (r: AgentReport): number => (r.cleared ? 1e9 : r.laneMetres > 0 ? r.reachedMetres / r.laneMetres : 0) + (r.probes.length ? 0.001 : 0);

export const sameLayout = (a: Layout, b: Layout): boolean => JSON.stringify(a.items) === JSON.stringify(b.items);

export type AgentEvent = { type: 'asking'; repair: boolean } | { type: 'testing' } | { type: 'step'; step: Step };
export interface AgentOptions { cap?: number; onEvent?: (e: AgentEvent) => void } // onEvent: the trace the player watches, live

// The loop. Step 1 asks with the photo (history carries it: the first user message is the photo's, built by `ask`); the next steps are text only.
export async function runAgent(ask: Ask, test: Test, opts: AgentOptions & { startFrom?: { layout: Layout; say: string } } = {}): Promise<AgentResult> {
  const cap = opts.cap ?? STEP_CAP;
  const steps: Step[] = [];
  const problems: string[] = [];
  let history: Message[] = [];
  let layout: Layout | null = opts.startFrom?.layout ?? null;
  let say = opts.startFrom?.say ?? '';
  let best: Step | null = null;
  let n = 0;
  let failedAsks = 0;
  while (n < cap) {
    if (!layout) { // ask for a first proposal (or retry after a bad answer)
      history = [{ role: 'user', content: firstAsk() }];
    } else if (steps.length) {
      const last = steps[steps.length - 1];
      history = [{ role: 'user', content: repairAsk(last.layout, last.report, steps[0].say) }];
    }
    if (steps.length || !layout) {
      opts.onEvent?.({ type: 'asking', repair: steps.length > 0 });
      const raw = await ask(history);
      if (raw === null) { problems.push('The model did not answer.'); if (++failedAsks >= 2) break; continue; }
      const parsed = parseLayout(raw);
      if (!parsed.layout) { problems.push(`The answer had no usable layout (${parsed.problems.join('; ') || 'no json block'}).`); if (++failedAsks >= 2) break; continue; }
      if (steps.length && sameLayout(parsed.layout, steps[steps.length - 1].layout)) problems.push('The repair left the layout unchanged.');
      layout = parsed.layout;
      say = parsed.text;
    }
    n++;
    opts.onEvent?.({ type: 'testing' });
    const report = await test(layout!);
    const step: Step = { n, kind: steps.length ? 'repaired' : 'proposed', say, layout: layout!, report, words: reportWords(report, layout!) };
    steps.push(step);
    opts.onEvent?.({ type: 'step', step });
    if (!best || progress(report) > progress(best.report)) best = step;
    if (report.cleared) return { status: 'cleared', layout: layout!, report, steps, problems };
    layout = layout!; // keep going from the tested layout
  }
  if (!best) return { status: 'no-layout', layout: null, report: null, steps, problems };
  return { status: 'not-cleared', layout: best.layout, report: best.report, steps, problems };
}

// How far a repair drifted from the answer key: a "clear" bought by deleting the obstacles would show here.
export function drift(layout: Layout | null, key: Layout): Score | null {
  return layout ? scoreLayout(layout, key) : null;
}
export const obstacleCount = (l: Layout | null): number => (l ? l.items.filter((it) => it.kind !== 'ground').length : 0);
