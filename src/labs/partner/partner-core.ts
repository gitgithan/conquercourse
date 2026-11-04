import { parseLayout, type Item, type Layout } from "../../slice/layout-draft";
import { reportWords, itemLength, AGENT_SYSTEM, type AgentReport } from "../../slice/course-agent";

// the design partner loop. The partner PROPOSES; the simulator JUDGES. This file holds the pure parts around the game's own code:
// reading a recorded reply (the game's parseLayout), the piece rule, what to call a result, the Fix it step that applies the easing the simulator proved,
// and the checks the challenges use. The simulator itself (testLayout in src/slice/course-agent-tools.ts) is run by the page's worker and by the tests.
export type Kind = "good" | "tooHard" | "unprovable" | "malformed" | "rule";
export interface Answer {
  id: string; kind: Kind; brief: string; source: string; note: string;
  layout?: Layout; raw?: string; say?: string;
  partnerRepair?: { say: string; layout: Layout };
}
export const KINDS: readonly { kind: Kind; label: string; about: string }[] = [
  { kind: "good", label: "Good", about: "The simulator clears it as drawn." },
  { kind: "tooHard", label: "Too hard", about: "Not cleared, but one change is proved to clear it." },
  { kind: "unprovable", label: "Not provable", about: "Not cleared, and no single change clears it." },
  { kind: "malformed", label: "Not a course", about: "The reply has no usable course in it." },
  { kind: "rule", label: "Breaks a rule", about: "A course, but it breaks a rule the partner was told." },
];

/** The rule the partner is told in its instructions ("At most 10 items"); read from the game's own text so the two cannot drift apart. */
export const MAX_ITEMS = Number(/At most (\d+) items/.exec(AGENT_SYSTEM)![1]);

export type Gate = "reader" | "rules" | "simulator" | "shown";
export const GATES: readonly { gate: Gate; name: string; does: string }[] = [
  { gate: "reader", name: "Reader", does: "Finds the course in the reply. No course, no go." },
  { gate: "rules", name: "Rules", does: `At most ${MAX_ITEMS} pieces.` },
  { gate: "simulator", name: "Simulator", does: "Searches for a run that clears it." },
  { gate: "shown", name: "Shown", does: "Only a cleared course is shown." },
];

/** The reply as text the reader sees: the recorded raw text, or the recorded layout fenced the way the partner is asked to answer. */
export const replyText = (a: Answer): string => a.raw ?? `${a.say ?? "A course for the idea."}\n\`\`\`json\n${JSON.stringify(a.layout)}\n\`\`\``;

export interface Read { layout: Layout | null; problems: string[] }
export function readAnswer(a: Answer): Read {
  const p = parseLayout(replyText(a));
  return { layout: p.layout, problems: p.problems };
}
export const ruleProblems = (l: Layout): string[] => (l.items.length > MAX_ITEMS ? [`${l.items.length} pieces; the partner is told at most ${MAX_ITEMS}`] : []);

export type Reject = "not-a-course" | "breaks-rule" | "not-provable";
export interface Verdict { gate: Gate; reject: Reject | null; words: string }
const NEEDS_SIM: Verdict = { gate: "simulator", reject: null, words: "Waiting for the simulator." };
/** Where an answer stops. Pass the simulator's report once it is known; before that the verdict says it is waiting. */
export function verdictOf(read: Read, report: AgentReport | null): Verdict {
  if (!read.layout) return { gate: "reader", reject: "not-a-course", words: `Thrown out before any test: ${read.problems.join("; ") || "no course in the reply"}.` };
  const rp = ruleProblems(read.layout);
  if (rp.length) return { gate: "rules", reject: "breaks-rule", words: `Thrown out before any test: ${rp[0]}.` };
  if (!report) return NEEDS_SIM;
  if (report.cleared) return { gate: "shown", reject: null, words: reportWords(report, read.layout) };
  return { gate: "simulator", reject: "not-provable", words: reportWords(report, read.layout) };
}

// ---- Fix it: apply the single change the simulator proved (its probes), then test again ----
const PROVED = /(lowered|narrowed) to ([\d.]+) m/;
export interface FixStep { layout: Layout; item: number; text: string }
/** The proved change nearest to where the best try stopped, applied to the layout. Null when the simulator proved none. */
export function fixStep(layout: Layout, report: AgentReport): FixStep | null {
  const at = report.stoppedAtItem ?? 0;
  const probe = [...report.probes].sort((a, b) => Math.abs(a.item - at) - Math.abs(b.item - at))[0];
  if (!probe) return null;
  const m = PROVED.exec(probe.text);
  const it = layout.items[probe.item];
  if (!m || !it) return null;
  const v = Number(m[2]);
  const items = layout.items.map((x) => ({ ...x }));
  if (it.kind === "gap") items[probe.item] = { ...it, width: v };
  else if (it.kind === "block" || it.kind === "bar") items[probe.item] = { ...it, height: v };
  else return null;
  return { layout: { items }, item: probe.item, text: probe.text };
}

// ---- tools for the challenges ----
export const sizeOf = (it: Item): number => (it.kind === "gap" ? it.width : it.kind === "block" || it.kind === "bar" ? it.height : it.length);
/** How many pieces differ between two layouts (a different kind, or any different size); a piece added or removed counts as one. */
export function changedPieces(a: Layout, b: Layout): number {
  let n = Math.abs(a.items.length - b.items.length);
  for (let i = 0; i < Math.min(a.items.length, b.items.length); i++) if (JSON.stringify(a.items[i]) !== JSON.stringify(b.items[i])) n++;
  return n;
}
/** How hard a layout is, in one number: every gap's width and every block's or bar's height, in metres, added up. Ground adds nothing. */
export const hardness = (l: Layout): number => Math.round(l.items.reduce((s, it) => s + (it.kind === "ground" ? 0 : sizeOf(it)), 0) * 100) / 100;
export const obstacles = (l: Layout): number => l.items.filter((i) => i.kind !== "ground").length;
export const totalLength = (l: Layout): number => l.items.reduce((s, it) => s + itemLength(it), 0);

/** Swap one piece for another kind, keeping a sensible size (a gap width, or a block or bar height). */
export function swapKind(l: Layout, i: number, kind: "gap" | "block" | "bar"): Layout {
  const it = l.items[i];
  if (!it || it.kind === "ground" || it.kind === kind) return l;
  const s = sizeOf(it);
  const next: Item = kind === "gap" ? { kind, width: Math.max(1.2, Math.min(9, s)) } : kind === "block" ? { kind, length: it.kind === "block" ? it.length : 1.5, height: Math.min(2.5, s) } : { kind, height: Math.max(2, Math.min(3.5, s)) };
  return { items: l.items.map((x, j) => (j === i ? next : x)) };
}
export function setSize(l: Layout, i: number, v: number): Layout {
  const it = l.items[i];
  if (!it) return l;
  const r = Math.round(v * 100) / 100;
  const next: Item = it.kind === "gap" ? { ...it, width: r } : it.kind === "block" || it.kind === "bar" ? { ...it, height: r } : { ...it, length: r };
  return { items: l.items.map((x, j) => (j === i ? next : x)) };
}
export const key = (l: Layout): string => JSON.stringify(l.items);

// ---- the challenges ----
export interface Challenge { id: string; title: string; ask: string; start: string; kind: "one-change" | "harder" | "why" | "honest"; reveal: string }
export const CHALLENGES: readonly Challenge[] = [
  { id: "one", title: "Change one thing", ask: "The simulator cannot clear this wall. Change ONE piece so it clears.", start: "m003", kind: "one-change", reveal: "Fix it lowered the same wall to the height the simulator proved. One piece changed, and the partner's idea (a wall, then a drop) is still there." },
  { id: "harder", title: "Harder, still provable", ask: "This course clears. Make it at least a quarter harder and keep it clear.", start: "m001", kind: "harder", reveal: "The simulator is the edge: past a point no run clears, and a harder course that cannot be cleared is not a course." },
  { id: "why", title: "Why was it thrown out?", ask: "Three replies were thrown out. Say which gate stopped each one.", start: "x1", kind: "why", reveal: "The reader stops replies with no course, the rules stop long courses, and only the simulator can say a course cannot be cleared." },
  { id: "honest", title: "Keep the 3 m wall", ask: "The brief asked for a 3 m wall and the partner eased it. Put it back to 3 m: does it clear?", start: "w3", kind: "honest", reveal: "Proved means proved at sizes the simulator accepts, not at the sizes the brief asked for. We say so in the evaluation." },
];
export const HARDER_TARGET = 1.25;
export function harderPass(start: Layout, now: Layout, report: AgentReport | null): { pass: boolean; why: string } {
  if (!report) return { pass: false, why: "Waiting for the simulator." };
  const ratio = hardness(now) / hardness(start);
  if (!report.cleared) return { pass: false, why: "The simulator cannot clear it." };
  if (obstacles(now) < obstacles(start)) return { pass: false, why: "Removing an obstacle does not make it harder." };
  return ratio >= HARDER_TARGET ? { pass: true, why: `Cleared, and ${Math.round((ratio - 1) * 100)}% harder.` } : { pass: false, why: `Cleared, but only ${Math.round((ratio - 1) * 100)}% harder (aim for 25%).` };
}
export function oneChangePass(start: Layout, now: Layout, report: AgentReport | null): { pass: boolean; why: string } {
  if (!report) return { pass: false, why: "Waiting for the simulator." };
  const n = changedPieces(start, now);
  if (n === 0) return { pass: false, why: "Nothing changed yet." };
  if (n > 1) return { pass: false, why: `${n} pieces changed; use only one.` };
  if (obstacles(now) < obstacles(start)) return { pass: false, why: "Taking the obstacle away is not a repair." };
  return report.cleared ? { pass: true, why: "One piece changed and the simulator clears it." } : { pass: false, why: "One piece changed, but the simulator still cannot clear it." };
}
/** The honest challenge: the brief asked for a 3 m wall; the recorded partner repair ended near 0.68 m (CC-133 text eval README). The layout around it is ours. */
export const EASED_WALL: Layout = { items: [{ kind: "ground", length: 8 }, { kind: "block", length: 1, height: 0.68 }, { kind: "ground", length: 8 }] };
export const WALL_ASKED = 3;
export function honestPass(now: Layout, report: AgentReport | null): { pass: boolean; why: string } {
  if (!report) return { pass: false, why: "Waiting for the simulator." };
  const wall = now.items.find((i) => i.kind === "block");
  const h = wall && wall.kind === "block" ? wall.height : 0;
  if (h < WALL_ASKED - 1e-9) return { pass: false, why: `The wall is ${h} m. Raise it to ${WALL_ASKED} m.` };
  return report.cleared ? { pass: false, why: "It clears at 3 m? Then this wall is not the one the lane needs." } : { pass: true, why: "Found out: at 3 m the simulator cannot clear it. The partner eased the wall to make it provable." };
}
