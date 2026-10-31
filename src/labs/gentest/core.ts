import { layoutToPieces, type Item, type Layout } from "../../slice/photo-course";
import { NO_TURN } from "../../slice/photo-proof";
import { roleCourse } from "../../slice/roles";
import { itemLength } from "../../slice/course-agent";
import { itemAt } from "../../slice/course-agent-tools";
import { meter, playPlan, searchIdealRun } from "../../sim/ideal";

// Lab 9, Generate and test (CC-118 family). A helper PROPOSES a course; the simulator DECIDES. This file holds the pure parts:
// the rules the player sets, the random proposer, one test through the real ideal-run search, a repair by easing, and the tally.
// The page makes no model call: the "Muse" proposals are recorded replies from an earlier offline run (public/assets/lab/gentest-proposals.json).
export interface Rules {
  gap: boolean; block: boolean; bar: boolean; // ground is always allowed: a lane needs somewhere to stand
  gapMin: number; gapMax: number; // metres wide
  blockMin: number; blockMax: number; // metres high
  maxItems: number; // pieces in one proposal, ground pieces included
}
export const DEFAULT_RULES: Rules = { gap: true, block: true, bar: true, gapMin: 1.2, gapMax: 9, blockMin: 0.2, blockMax: 2.5, maxItems: 10 };
export type Source = "recorded" | "random" | "both";
export interface Config { rules: Rules; source: Source; repairs: number; randomCount: number; seed: number }
export const DEFAULT_CONFIG: Config = { rules: DEFAULT_RULES, source: "recorded", repairs: 0, randomCount: 30, seed: 7 };
export const BAR_MIN = 2, BAR_MAX = 3.5;

export interface Proposal { id: string; source: "recorded" | "random"; theme: string; layout: Layout | null }
export const REASONS = ["The reply was not a course", "Under 8 m of ground", "A gap is too wide", "A block is too tall", "A bar is out of reach", "Stopped on plain ground"] as const;
export type Why = (typeof REASONS)[number];
export interface Verdict {
  id: string; source: "recorded" | "random"; theme: string;
  firstClear: boolean; // cleared as proposed
  cleared: boolean; // cleared after at most `repairs` repairs
  repairsUsed: number;
  why: Why | null; // why the first test threw it out
  stoppedAt: number; // index of the piece the best try stopped at (-1 none)
  layout: Layout | null; fixed: Layout | null;
  ticks: number; // simulator ticks spent on this proposal (all tests and repairs)
}

export const clampRules = (r: Rules): Rules => {
  const c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const gapMin = c(r.gapMin, 1.2, 9), blockMin = c(r.blockMin, 0.2, 2.5);
  return { ...r, gapMin, gapMax: c(r.gapMax, gapMin, 9), blockMin, blockMax: c(r.blockMax, blockMin, 2.5), maxItems: Math.round(c(r.maxItems, 3, 12)) };
};

/** Does a recorded proposal stay inside what the player allows? */
export function fits(layout: Layout, r: Rules): boolean {
  if (layout.items.length > r.maxItems) return false;
  return layout.items.every((it) => {
    if (it.kind === "gap") return r.gap && it.width >= r.gapMin - 1e-9 && it.width <= r.gapMax + 1e-9;
    if (it.kind === "block") return r.block && it.height >= r.blockMin - 1e-9 && it.height <= r.blockMax + 1e-9;
    if (it.kind === "bar") return r.bar;
    return true;
  });
}

// A small seeded random number generator, so the same seed gives the same proposals.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The built-in random proposer: ground first and last, other pieces drawn from what is allowed, sizes uniform inside the ranges. */
export function randomLayout(rand: () => number, rules: Rules): Layout {
  const r = clampRules(rules);
  const kinds: ("gap" | "block" | "bar")[] = [];
  if (r.gap) kinds.push("gap");
  if (r.block) kinds.push("block");
  if (r.bar) kinds.push("bar");
  const n = 3 + Math.floor(rand() * (r.maxItems - 2)); // 3 .. maxItems pieces in all
  const items: Item[] = [{ kind: "ground", length: r2(8 + rand() * 6) }];
  while (kinds.length && items.length < n - 1) {
    const k = kinds[Math.floor(rand() * kinds.length)];
    if (k === "gap") { if (items.length + 3 > n) break; items.push({ kind: "gap", width: r2(r.gapMin + rand() * (r.gapMax - r.gapMin)) }, { kind: "ground", length: r2(4 + rand() * 6) }); }
    else if (k === "block") items.push({ kind: "block", length: r2(2 + rand() * 4), height: r2(r.blockMin + rand() * (r.blockMax - r.blockMin)) });
    else items.push({ kind: "bar", height: r2(BAR_MIN + rand() * (BAR_MAX - BAR_MIN)) });
  }
  items.push({ kind: "ground", length: r2(6 + rand() * 4) });
  return { items };
}

// ---- one test: the real ideal-run search on the layout's course ----
interface Tried { cleared: boolean; laneShort: boolean; stoppedAt: number }
function position(layout: Layout, course: ReturnType<typeof roleCourse>["course"], maxX: number): number {
  const total = layout.items.reduce((s, it) => s + itemLength(it), 0);
  let best = 0, d = Infinity;
  for (const m of course.uMap ?? []) {
    const x = Math.min(m.x0 + (m.u1 - m.u0), Math.max(m.x0, maxX));
    if (Math.abs(maxX - x) < d) { d = Math.abs(maxX - x); best = m.u0 + (x - m.x0) + total / 2; }
  }
  return best;
}
export function testOnce(layout: Layout): Tried {
  const { course, length } = roleCourse(layoutToPieces(layout), NO_TURN, "gentest");
  if (length < 8) return { cleared: false, laneShort: true, stoppedAt: -1 };
  const found = searchIdealRun(course);
  if (found.cleared) return { cleared: true, laneShort: false, stoppedAt: -1 };
  const p = playPlan(course, found.plan);
  return { cleared: false, laneShort: false, stoppedAt: itemAt(layout, Math.round(position(layout, course, p.maxX) * 100) / 100) };
}

export function whyOf(layout: Layout, t: Tried): Why {
  if (t.laneShort) return "Under 8 m of ground";
  const k = t.stoppedAt >= 0 ? layout.items[t.stoppedAt].kind : "ground";
  return k === "gap" ? "A gap is too wide" : k === "block" ? "A block is too tall" : k === "bar" ? "A bar is out of reach" : "Stopped on plain ground";
}

/** The repair: ease the piece the best try stopped at by a fifth, never past the player's own minimum. Null when nothing can be eased. */
export function ease(layout: Layout, at: number, rules: Rules): Layout | null {
  const it = layout.items[at];
  if (!it) return null;
  const items = layout.items.map((x) => ({ ...x }));
  if (it.kind === "gap") { const w = Math.max(rules.gapMin, r2(it.width * 0.8)); if (w >= it.width) return null; items[at] = { ...it, width: w }; }
  else if (it.kind === "block") { const h = Math.max(rules.blockMin, r2(it.height * 0.8)); if (h >= it.height) return null; items[at] = { ...it, height: h }; }
  else if (it.kind === "bar") { const h = Math.max(BAR_MIN, r2(it.height * 0.9)); if (h >= it.height) return null; items[at] = { ...it, height: h }; }
  else return null;
  return { items };
}

export function testProposal(p: Proposal, rules: Rules, repairs: number): Verdict {
  const t0 = meter.ticks;
  const base: Verdict = { id: p.id, source: p.source, theme: p.theme, firstClear: false, cleared: false, repairsUsed: 0, why: null, stoppedAt: -1, layout: p.layout, fixed: null, ticks: 0 };
  if (!p.layout) return { ...base, why: "The reply was not a course" };
  let cur = p.layout;
  let t = testOnce(cur);
  if (t.cleared) return { ...base, firstClear: true, cleared: true, ticks: meter.ticks - t0 };
  base.why = whyOf(cur, t); base.stoppedAt = t.stoppedAt;
  for (let i = 1; i <= repairs; i++) {
    const next = ease(cur, t.stoppedAt, rules);
    if (!next) break;
    cur = next; t = testOnce(cur); base.repairsUsed = i;
    if (t.cleared) { base.cleared = true; base.fixed = cur; break; }
  }
  return { ...base, ticks: meter.ticks - t0 };
}

export function buildProposals(recorded: { id: string; theme: string; layout: Layout | null }[], cfg: Config): Proposal[] {
  const rules = clampRules(cfg.rules);
  const out: Proposal[] = [];
  if (cfg.source !== "random") for (const r of recorded) if (!r.layout || fits(r.layout, rules)) out.push({ id: r.id, source: "recorded", theme: r.theme, layout: r.layout });
  if (cfg.source !== "recorded") { const rand = rng(cfg.seed); for (let i = 0; i < cfg.randomCount; i++) out.push({ id: `r${i + 1}`, source: "random", theme: "random draw", layout: randomLayout(rand, rules) }); }
  return out;
}

// ---- the tally ----
export interface Tally {
  tested: number; first: number; afterRepair: number; thrown: number;
  pFirst: number; pRepair: number;
  triesFirst: number | null; triesRepair: number | null; // expected tries to one clear = 1 / p
  firstIndex: number | null; firstIndexRepair: number | null; // proposals up to and including the first clear (1-based)
  reasons: Record<string, number>;
  ticks: number;
}
export function tally(vs: Verdict[]): Tally {
  const n = vs.length, first = vs.filter((v) => v.firstClear).length, all = vs.filter((v) => v.cleared).length;
  const reasons: Record<string, number> = {};
  for (const v of vs) if (!v.firstClear && v.why) reasons[v.why] = (reasons[v.why] ?? 0) + 1;
  const idx = (f: (v: Verdict) => boolean) => { const i = vs.findIndex(f); return i < 0 ? null : i + 1; };
  return {
    tested: n, first, afterRepair: all - first, thrown: n - all,
    pFirst: n ? first / n : 0, pRepair: n ? all / n : 0,
    triesFirst: first ? n / first : null, triesRepair: all ? n / all : null,
    firstIndex: idx((v) => v.firstClear), firstIndexRepair: idx((v) => v.cleared),
    reasons, ticks: vs.reduce((s, v) => s + v.ticks, 0),
  };
}
