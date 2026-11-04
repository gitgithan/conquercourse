// Lab 17: Spike the riskiest call first. Pure logic, no page: the risk board, the plan timeline, the budget check and the two real stories.
// A "risk" is something that can stop a new move or obstacle. Each one has a piece of work to build on top of it ("build") and a cheap test that finds out early ("spike").
// The numbers for the chances and the build hours are our own guesses written before the work (they are sliders in the page); the costs, minutes and counts in the stories are read from data/eval.

export interface Risk {
  id: string;
  name: string;
  /** Why we think it can fail: the evidence in our own files, in one plain line. */
  why: string;
  /** Chance it fails, in percent (a guess before the test). */
  p: number;
  /** Hours of work built on top of it. */
  build: number;
  /** Hours the cheapest test takes. */
  test: number;
  /** Money the cheapest test costs, in dollars. */
  usd: number;
  /** Hours to switch to the fallback when it fails. */
  fb: number;
  /** Other risks whose built work this one sits on: if one of them fails, this work is lost too. */
  deps: string[];
  /** Other risks that must be spiked first, or this test has nothing real to run on and counts as "not tested". */
  needs: string[];
}
export interface Budget { foundBy: number; wasted: number; usd: number }
export interface Scenario { id: string; title: string; blurb: string; risks: Risk[]; play: number; budget: Budget; source: string }
export type StepKind = 'build' | 'spike';
export interface Step { kind: StepKind; id: string }

export const BARS: Scenario = {
  id: 'bars',
  title: 'Add a bar obstacle (monkey bars from a photo)',
  blurb: 'A new obstacle: a photo of real monkey bars becomes a row of rungs the runner can swing along.',
  play: 0.5,
  budget: { foundBy: 4, wasted: 2, usd: 0.5 },
  source: 'docs/lessons-obstacle-creation.md, docs/lessons-move-creation.md, data/eval/demo-lifts, data/eval/bar-photos, data/eval/bar-motion',
  risks: [
    { id: 'gate', name: 'The photo passes the checks', why: 'People rule, safety check and privacy blur run before any model sees it.', p: 10, build: 1, test: 0.2, usd: 0, fb: 0.5, deps: [], needs: [] },
    { id: 'find', name: 'The finder outlines the bars', why: 'On the bar photos it outlined the whole frame on 4 of 8 and missed the loops on one.', p: 50, build: 1, test: 0.2, usd: 0.01, fb: 1, deps: ['gate'], needs: ['gate'] },
    { id: 'lift', name: 'The 3D lift is usable', why: '7 of 8 bar photos gave a usable frame; 1 failed where posts hide the bars.', p: 25, build: 2, test: 0.3, usd: 0.04, fb: 1, deps: ['find'], needs: ['find'] },
    { id: 'fit', name: 'The collider is one clean row', why: 'Lab 15: a missed rung is absorbed, but fused rungs can still fool the fit.', p: 20, build: 4, test: 0.5, usd: 0, fb: 2, deps: ['lift'], needs: ['lift'] },
    { id: 'reach', name: 'The move works on the row', why: 'The reach rule has to carry the runner from rung to rung.', p: 15, build: 6, test: 1, usd: 0, fb: 3, deps: ['fit'], needs: ['fit'] },
    { id: 'body', name: 'A body hangs from the rungs', why: 'Captured motion: 0 of 22 hang stretches pass hand over hand; Kimodo 0 of 8.', p: 85, build: 8, test: 0.3, usd: 0.1, fb: 3, deps: [], needs: [] },
  ],
};

export const WALL: Scenario = {
  id: 'wall',
  title: 'Add a wall clip (CC-17, the Warped Wall)',
  blurb: 'A new move clip: the Rookie runs up the 4.3 m curve, grabs the top edge and pulls up.',
  play: 0.5,
  budget: { foundBy: 3, wasted: 2, usd: 0.2 },
  source: 'data/eval/cc-17-wall, docs/lessons.md (Process), docs/model-limits.md',
  risks: [
    { id: 'reach', name: 'A body can reach the grab', why: 'The simulator grabs 2.42 m from the hips; a Rookie arm reaches 1.07 m (a free check on the CPU).', p: 90, build: 4, test: 0.3, usd: 0, fb: 2, deps: [], needs: [] },
    { id: 'tools', name: 'Our tools hold the contacts', why: 'The 0 of 36 text-only tries had no path and no contact targets, so they were not tested.', p: 25, build: 10, test: 1, usd: 0, fb: 3, deps: [], needs: [] },
    { id: 'height', name: 'The model follows the path in height', why: 'Kimodo bodies go bad above about 2.5 m of rise; this wall needs 4.3 m.', p: 85, build: 3, test: 0.6, usd: 0.04, fb: 4, deps: ['tools', 'reach'], needs: ['tools', 'reach'] },
    { id: 'gate', name: 'The clip passes the gate', why: 'Every round-1 sample failed the knee and leg rules.', p: 50, build: 2, test: 0.1, usd: 0, fb: 2, deps: ['height'], needs: ['height'] },
    { id: 'course', name: 'The clip fits the course', why: 'The clip has to match the simulator timing, climb and mantle.', p: 20, build: 3, test: 0.5, usd: 0, fb: 2, deps: ['gate'], needs: ['gate'] },
  ],
};
export const SCENARIOS: readonly Scenario[] = [BARS, WALL];
export const cloneScenario = (s: Scenario): Scenario => ({ ...s, budget: { ...s.budget }, risks: s.risks.map((r) => ({ ...r, deps: [...r.deps], needs: [...r.needs] })) });

const byId = (sc: Scenario, id: string): Risk => {
  const r = sc.risks.find((x) => x.id === id);
  if (!r) throw new Error(`no risk ${id}`);
  return r;
};

/** The risk and everything built on top of it (directly or further up). If it fails, all of this work is lost. */
export function riding(sc: Scenario, id: string): Set<string> {
  const out = new Set<string>([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of sc.risks) if (!out.has(r.id) && r.deps.some((d) => out.has(d))) { out.add(r.id); grew = true; }
  }
  return out;
}
export const ridingHours = (sc: Scenario, id: string): number => [...riding(sc, id)].reduce((a, k) => a + byId(sc, k).build, 0);
/** Chance it fails times the work riding on it, in hours: how much we expect to lose if we only find out at the end. */
export const scare = (sc: Scenario, id: string): number => (byId(sc, id).p / 100) * ridingHours(sc, id);
/** Highest scare first; the cheaper test breaks a tie. */
export const rankByScare = (sc: Scenario): string[] => sc.risks.map((r) => r.id).sort((a, b) => scare(sc, b) - scare(sc, a) || byId(sc, a).test - byId(sc, b).test);

/** Builds in an order where each piece comes after the pieces it sits on (the board order breaks ties). */
export function buildOrder(sc: Scenario, prefer: string[] = sc.risks.map((r) => r.id)): string[] {
  const done: string[] = [];
  while (done.length < sc.risks.length) {
    const next = prefer.find((id) => !done.includes(id) && byId(sc, id).deps.every((d) => done.includes(d)));
    if (!next) throw new Error('dependency cycle');
    done.push(next);
  }
  return done;
}
/** The spike order that is allowed by the "needs" and takes the scariest one that can be tested next. */
export function spikeOrder(sc: Scenario): string[] {
  const rank = rankByScare(sc), done: string[] = [];
  while (done.length < sc.risks.length) {
    const next = rank.find((id) => !done.includes(id) && byId(sc, id).needs.every((d) => done.includes(d)));
    if (!next) throw new Error('needs cycle');
    done.push(next);
  }
  return done;
}

/** "Build it all, test at the end": every build first, then every test. */
export const latePlan = (sc: Scenario): Step[] => [...buildOrder(sc).map((id): Step => ({ kind: 'build', id })), ...buildOrder(sc).map((id): Step => ({ kind: 'spike', id }))];
/** "Spike first": the tests in the given order, then the builds. A test put before the test it needs counts as not tested. */
export const earlyPlan = (sc: Scenario, order: string[] = spikeOrder(sc)): Step[] => [...order.map((id): Step => ({ kind: 'spike', id })), ...buildOrder(sc).map((id): Step => ({ kind: 'build', id }))];
/** One plan that passes the challenge: the allowed order of tests, scariest first, then the builds. */
export const referencePlan = (sc: Scenario): Step[] => earlyPlan(sc, spikeOrder(sc));

export function validatePlan(sc: Scenario, plan: Step[]): string[] {
  const problems: string[] = [];
  for (const r of sc.risks) {
    for (const kind of ['build', 'spike'] as StepKind[]) {
      const n = plan.filter((s) => s.id === r.id && s.kind === kind).length;
      if (n === 0) problems.push(`${kind === 'build' ? 'Build' : 'Test'} "${r.name}" is missing`);
      if (n > 1) problems.push(`${kind === 'build' ? 'Build' : 'Test'} "${r.name}" is there twice`);
    }
  }
  const built = new Set<string>();
  for (const s of plan) {
    if (s.kind !== 'build') continue;
    const r = byId(sc, s.id);
    for (const d of r.deps) if (!built.has(d)) problems.push(`"${r.name}" is built before "${byId(sc, d).name}", which it sits on`);
    built.add(s.id);
  }
  return problems;
}

export interface Outcome {
  valid: boolean;
  problems: string[];
  /** Tests that ran before the test they need: no result, not "passed" and not "failed". */
  notTested: string[];
  /** How the failure was found: a real test, the final play of the whole thing, or never (nothing failed). */
  how: 'spike' | 'play' | 'none';
  foundHour: number | null;
  foundUsd: number | null;
  /** Index in the plan of the step that found it (plan.length for the final play). */
  foundIndex: number | null;
  /** Hours of built work thrown away. */
  wasted: number;
  fb: number;
  /** Hours for the whole project: every step, the final play, the thrown-away work built again and the fallback. */
  total: number;
  usd: number;
  hours: number;
}

/** Run the plan once with one thing really failing (or nothing, failing = null). */
export function evaluate(sc: Scenario, plan: Step[], failing: string | null): Outcome {
  const problems = validatePlan(sc, plan);
  let h = 0, usd = 0, foundHour: number | null = null, foundUsd: number | null = null, foundIndex: number | null = null;
  let how: Outcome['how'] = 'none', wasted = 0;
  const built = new Set<string>(), tested = new Set<string>(), notTested: string[] = [];
  const lost = failing ? riding(sc, failing) : new Set<string>();
  const wastedNow = () => [...built].filter((k) => lost.has(k)).reduce((a, k) => a + byId(sc, k).build, 0);
  plan.forEach((s, i) => {
    const r = byId(sc, s.id);
    if (s.kind === 'build') { h += r.build; built.add(s.id); return; }
    h += r.test; usd += r.usd;
    if (r.needs.every((n) => tested.has(n))) tested.add(s.id); else notTested.push(s.id);
    if (failing === s.id && tested.has(s.id) && how === 'none') { how = 'spike'; foundHour = h; foundUsd = usd; foundIndex = i; wasted = wastedNow(); }
  });
  const hours = h + sc.play;
  if (failing && how === 'none') { how = 'play'; foundHour = hours; foundUsd = usd; foundIndex = plan.length; wasted = wastedNow(); }
  const fb = failing ? byId(sc, failing).fb : 0;
  return { valid: problems.length === 0, problems, notTested, how, foundHour, foundUsd, foundIndex, wasted, fb, total: hours + wasted + fb, usd, hours };
}

/** Average extra hours (thrown-away work plus the fallback) weighted by the chance of each failure. */
export function expectedExtra(sc: Scenario, plan: Step[]): number {
  return sc.risks.reduce((a, r) => { const o = evaluate(sc, plan, r.id); return a + (r.p / 100) * (o.wasted + o.fb); }, 0);
}

export interface ChallengeRow { id: string; how: Outcome['how']; foundHour: number | null; wasted: number; foundOk: boolean; wastedOk: boolean; viaTest: boolean }
export interface ChallengeResult { ok: boolean; rows: ChallengeRow[]; usd: number; usdOk: boolean; problems: string[] }
/** The hard check: whatever single thing fails, a real test finds it by the hour limit, with at most the wasted limit thrown away, and the tests cost at most the money limit. */
export function checkChallenge(sc: Scenario, plan: Step[]): ChallengeResult {
  const b = sc.budget;
  const rows = sc.risks.map((r): ChallengeRow => {
    const o = evaluate(sc, plan, r.id);
    return { id: r.id, how: o.how, foundHour: o.foundHour, wasted: o.wasted, viaTest: o.how === 'spike', foundOk: o.how === 'spike' && o.foundHour !== null && o.foundHour <= b.foundBy + 1e-9, wastedOk: o.wasted <= b.wasted + 1e-9 };
  });
  const usd = evaluate(sc, plan, null).usd, problems = validatePlan(sc, plan);
  const usdOk = usd <= b.usd + 1e-9;
  return { ok: problems.length === 0 && usdOk && rows.every((r) => r.foundOk && r.wastedOk), rows, usd, usdOk, problems };
}

/** A test only counts when everything it needs exists. Missing inputs give "not tested" and the result is not read as a pass or a fail. */
export interface Verdict { status: 'passed' | 'failed' | 'not tested'; missing: string[] }
/** `passed` is the number of samples that met every pass line; one is enough (the stop rule of CC-17). */
export function verdict(needs: string[], have: string[], passed: number, _total: number): Verdict {
  const missing = needs.filter((n) => !have.includes(n));
  if (missing.length) return { status: 'not tested', missing };
  return { status: passed > 0 ? 'passed' : 'failed', missing };
}

// ---- the two real stories (numbers from data/eval; the test reads the same files and checks them) ----
export interface StoryEvent { id: string; title: string; kind: 'free' | 'paid' | 'not tested'; minutes: number | null; usd: number; told: string; decided: string }
export interface Story { id: string; title: string; issue: string; folder: string; events: StoryEvent[]; ending: string }
const L4_USD_PER_MIN = 0.8 / 60;
const wallRound = (minutes: number) => Math.round(minutes * L4_USD_PER_MIN * 1000) / 1000;
export const WALL_ROUND_MINUTES = [2.95, 2.19] as const;
export const STORIES: readonly Story[] = [
  {
    id: 'wall', title: 'The wall clip', issue: 'CC-17', folder: 'data/eval/cc-17-wall', ending: 'Stopped after round 2 by the stop rule written before round 1. No wall clip ships. Spent about $0.07.',
    events: [
      { id: 'text', title: 'Text-only tries', kind: 'not tested', minutes: null, usd: 0, told: '0 of 36 samples worked, but they had no path and no contact targets.', decided: 'Not a fail. Build the missing tools first (docs/lessons.md, Process).' },
      { id: 'tools', title: 'Build the tools', kind: 'free', minutes: null, usd: 0, told: 'Path export, contact targets, contact IK and the gate now exist.', decided: 'Now a paid test is a real test.' },
      { id: 'cpu', title: 'Free check on the CPU', kind: 'free', minutes: null, usd: 0, told: 'The simulator grabs 2.42 m from the hips. A Rookie arm reaches 1.07 m.', decided: 'Aim at the grab a body can make: frame 65, 0.95 m.' },
      { id: 'r1', title: 'Round 1 (the recipe)', kind: 'paid', minutes: WALL_ROUND_MINUTES[0], usd: wallRound(WALL_ROUND_MINUTES[0]), told: 'Best seed 11 met 2 of 8 pass lines. The hips are 0.15 to 2.4 m too low.', decided: 'Change one thing: stronger guidance.' },
      { id: 'r2', title: 'Round 2 (guidance 2 to 6)', kind: 'paid', minutes: WALL_ROUND_MINUTES[1], usd: wallRound(WALL_ROUND_MINUTES[1]), told: 'Worse: still 2 of 8, hips up to 3 m off.', decided: 'The stop rule fires. Rank the cheaper options A to F.' },
    ],
  },
  {
    id: 'bars', title: 'The monkey-bar motion', issue: 'CC-133', folder: 'data/eval/bar-motion', ending: 'Hand-over-hand travel could not come from capture or from Kimodo. The procedural fallback shipped. The failure cost about $0.10.',
    events: [
      { id: 'cmu', title: 'Scan the capture set (CPU)', kind: 'free', minutes: null, usd: 0, told: '22 hang stretches: 0 pass hand-over-hand travel, 12 pass idle, 11 pass kip.', decided: 'Capture cannot give travel. Try the generator.' },
      { id: 'kimodo', title: 'Kimodo round 1 (travel and kip)', kind: 'paid', minutes: 4, usd: 0.1, told: 'Travel: 3 of 8 pass the gate, 0 of 8 pass the bar check. Kip: 0 of 8. The hands stay near 1.1 m, the rungs are at 2.2 m.', decided: 'Same cause for idle, so do not retry it.' },
      { id: 'idle', title: 'Kimodo idle job', kind: 'free', minutes: null, usd: 0, told: 'Never started (queued), stopped. Not retried.', decided: 'No more paid runs for the same cause.' },
      { id: 'pexels', title: 'Look at the Pexels clip', kind: 'free', minutes: null, usd: 0, told: 'It is vertical bar climbing, not hand over hand.', decided: 'Not run through the body model.' },
      { id: 'fallback', title: 'Ship the fallback', kind: 'free', minutes: null, usd: 0, told: 'Three procedural clips pass the gate and the bar checks. They look stiff.', decided: 'Ship it now. Film a real clip later if the look matters.' },
    ],
  },
];
export const storyTotals = (s: Story, upTo: number): { usd: number; minutes: number; free: number; paid: number } => {
  const ev = s.events.slice(0, upTo + 1);
  return { usd: Math.round(ev.reduce((a, e) => a + e.usd, 0) * 1000) / 1000, minutes: Math.round(ev.reduce((a, e) => a + (e.minutes ?? 0), 0) * 100) / 100, free: ev.filter((e) => e.kind !== 'paid').length, paid: ev.filter((e) => e.kind === 'paid').length };
};

/** The "not tested" demo: the wall tries, with what each one had. */
export const WALL_TEST_NEEDS = ['path', 'targets', 'ik', 'gate'] as const;
export const WALL_TEST_LABELS: Record<(typeof WALL_TEST_NEEDS)[number], string> = { path: 'The simulator path', targets: 'Contact targets', ik: 'Contact repair (IK, push-out)', gate: 'The plausibility gate with the held-clip rule' };
