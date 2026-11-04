import data from "./limits-data.json";

// Lab: what the model cannot do): the logic, with no page. Every number comes from files already in the repo (see scripts/lab-limits-build.py).
// 1. The failure cards and the three bins.  2. The lift-shape gate on 14 real photos: precision and recall as the limit moves.
// 3. The finder's score cut on the monkey-bars photo.  4. The "cheapest safe design" rules for three stages.

// ---------- 1. cards ----------
export type BinId = "cant" | "help" | "none";
export type InsteadKind = "fallback" | "simulator" | "gate" | "human";
export interface BinInfo { id: BinId; title: string; line: string }
export const BINS: readonly BinInfo[] = [
  { id: "cant", title: "Can't do it", line: "The model fails here. We leave the job out or do it another way." },
  { id: "help", title: "Can, with help", line: "It works when a check, a retry or a person stands beside it." },
  { id: "none", title: "No model needed", line: "A plain rule or the simulator does it better." },
];
export const KIND_NAME: Record<InsteadKind, string> = { fallback: "Fallback", simulator: "Simulator as judge", gate: "Plausibility gate", human: "A person drags a box" };

export interface FailCard {
  id: string;
  title: string;
  model: string;
  picture: string; // under public/assets/labs/limits/
  returned: string; // what the model gave back, with the recorded number
  bin: BinId;
  kind: InsteadKind;
  instead: string; // what the product does instead (one or two plain lines)
  source: string; // the tracked file the numbers come from
}
const F = (p: string) => `/assets/labs/limits/${p}.webp`;
export const CARDS: readonly FailCard[] = [
  { id: "finder-bars", title: "Find the monkey bars", model: "SAM 3 finder", picture: F("card-finder-bars"), bin: "help", kind: "human",
    returned: "12 outlines: 9 poles, 2 walls, 1 weak 'overhead bars' at 0.46. Best overlap with the two bar patterns: 2% and 5%.",
    instead: "The player drags a box round the bars. The 3D maker accepts a box and a name.", source: "data/eval/demo-lifts/finder_vs_red_boxes.json" },
  { id: "stairs", title: "Lift a set of steps", model: "SAM 3D Objects", picture: F("card-stairs"), bin: "cant", kind: "fallback",
    returned: "Two flat slabs, no steps. The lift is 6.2 times wider than tall; the mask is 2.0.",
    instead: "Steps are left out of lifts. The editor builds steps from our own pieces.", source: "data/eval/cc-upload-hard-set/README.md" },
  { id: "tangle", title: "Lift a rack under bikes", model: "SAM 3D Objects", picture: F("card-tangle"), bin: "help", kind: "human",
    returned: "Bikes lost, only a flat grid of bars. The shape check did not flag it (ratio 1.37).",
    instead: "The player looks at the lift before it is used. A bad one is thrown away and retried.", source: "data/eval/cc-upload-hard-set/README.md" },
  { id: "strip", title: "Lift a saved box", model: "SAM 3D Objects", picture: F("card-strip"), bin: "help", kind: "gate",
    returned: "The saved box was a thin shadow strip. It was scaled to a 33 m slab.",
    instead: "The box is checked before the lift, and a 33 m slab is refused for size.", source: "data/eval/cc-38-photo-to-3d/README.md" },
  { id: "wall-table", title: "Lift a painted wall", model: "SAM 3 mask, then 3D", picture: F("card-wall-table"), bin: "help", kind: "fallback",
    returned: "A wall that touched the photo edge came out as a table.",
    instead: "Pad the photo to 1.5 times and try again. It then stands as a wall.", source: "data/eval/cc-38-photo-to-3d/README.md" },
  { id: "bars-size", title: "Size of the bars", model: "SAM 3D Objects", picture: F("card-bars-flat"), bin: "none", kind: "fallback",
    returned: "Right proportions, wrong size: bars typed 2.4 m came out 52 m wide.",
    instead: "Size comes from a typed or typical height. The model is never asked.", source: "docs/model-limits.md" },
  { id: "bars-row", title: "Collision for the bars", model: "none: plain shape", picture: F("card-bars-row"), bin: "none", kind: "simulator",
    returned: "The mesh is only a skin. The collider is a fitted row of 9 rungs, 0.575 m apart.",
    instead: "The simulator proves the row: the recorded keys clear it in 914 ticks.", source: "docs/labs/collision.md" },
  { id: "hang", title: "A hang on the bars", model: "Kimodo", picture: F("card-hang-samples"), bin: "cant", kind: "gate",
    returned: "Hands stayed about 1 m off the rungs. 3 of 8 passed the clip gate; 0 of 8 passed the bar check.",
    instead: "Hang, swing and bar clips come from motion capture or our own bar clips. The gate stops the rest.", source: "data/eval/bar-motion/README.md" },
  { id: "fence", title: "Lift a rail fence", model: "SAM 3D Objects", picture: F("card-fence"), bin: "cant", kind: "fallback",
    returned: "The thin rails came out as one heap. Not shipped.",
    instead: "Hang bars are placed by hand with a hold bar at the real crossbar height.", source: "data/eval/cc-110-real-objects/README.md" },
  { id: "triage", title: "Guess if a photo will lift", model: "Muse Spark Open", picture: F("card-triage"), bin: "none", kind: "gate",
    returned: "Called this photo poor (2 of 5). The lift was good. It agreed with the lift on 3 of 14 photos.",
    instead: "No guess: lift it and look. The lift costs about 1 cent and the shape check reads it.", source: "data/eval/cc-123-photo-triage/results.json" },
  { id: "pixel", title: "Is this upload safe?", model: "Muse Spark Open", picture: F("card-pixel"), bin: "help", kind: "human",
    returned: "A valid 1 x 1 white pixel got the answer ok. Any error counts as review.",
    instead: "The check fails closed, and a person looks at what is not clearly fine.", source: "data/eval/cc-120-safety-real/README.md" },
];
export const cardById = (id: string): FailCard => CARDS.find((c) => c.id === id)!;

/** Score a player's sorting: how many placed cards are in our bin, and how many are placed at all. */
export function scoreSort(placed: Record<string, BinId | undefined>): { placed: number; right: number; total: number } {
  let p = 0, r = 0;
  for (const c of CARDS) { const b = placed[c.id]; if (b) { p++; if (b === c.bin) r++; } }
  return { placed: p, right: r, total: CARDS.length };
}
export const ourSorting = (): Record<string, BinId> => Object.fromEntries(CARDS.map((c) => [c.id, c.bin]));

// ---------- 2. the gate ----------
export type Rating = "usable" | "partly" | "bad";
export interface GateRow { photo: string; rating: Rating; note: string; extent_aspect: number; mask_aspect: number; ratio: number; game_says_bad: boolean }
export const GATE_ROWS = data.gate as GateRow[];
/** The game's own limit: a lift is flagged when its width over height is more than 2 times, or under half of, the mask's (pipelines/ccpipe/padretry.py still_bad). */
export const GAME_LIMIT = 2;
export const LIMIT_MIN = 1.1, LIMIT_MAX = 4;

/** Flagged by the gate when the ratio is outside 1/limit .. limit. */
export const flagged = (ratio: number, limit: number): boolean => ratio > limit || ratio < 1 / limit;
export interface Confusion { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null; f1: number | null }
/** The 2 by 2 table and the three scores. A "positive" is a lift a person rated bad (or, if partlyIsBad, bad or partly). Undefined scores are null, never 0 or NaN. */
export function confusion(rows: readonly GateRow[], limit: number, partlyIsBad = false): Confusion {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const positive = r.rating === "bad" || (partlyIsBad && r.rating === "partly");
    const f = flagged(r.ratio, limit);
    if (f && positive) tp++; else if (f) fp++; else if (positive) fn++; else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : null, recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : precision !== null && recall !== null ? 0 : null;
  return { tp, fp, fn, tn, precision, recall, f1 };
}
/** Precision and recall for every limit on a grid, for the little curve. */
export function sweep(rows: readonly GateRow[], partlyIsBad = false, steps = 60): { limit: number; c: Confusion }[] {
  return Array.from({ length: steps + 1 }, (_, i) => { const limit = LIMIT_MIN + ((LIMIT_MAX - LIMIT_MIN) * i) / steps; return { limit, c: confusion(rows, limit, partlyIsBad) }; });
}
/** The ratio recomputed from the two aspects, so the table can be checked against the data file. */
export const ratioOf = (r: Pick<GateRow, "extent_aspect" | "mask_aspect">): number => r.extent_aspect / r.mask_aspect;
export const pct = (x: number | null): string => (x === null ? "n/a" : `${Math.round(x * 100)}%`);

// ---------- 3. the finder's score cut ----------
export interface FinderItem { label: string; score: number; box: number[] }
export const FINDER_ITEMS = data.finder.outlines as FinderItem[];
export const FINDER_BEST_IOU = data.finder.best_iou_with_bar_patterns as { loops_top: number; left_grid: number };
/** Outlines kept at a score cut, and the best overlap any outline has with a bar pattern. A cut can only throw outlines away, so it cannot raise the best overlap. */
export function finderCut(cut: number): { kept: number; of: number; bestIou: number; patternsFound: number } {
  const kept = FINDER_ITEMS.filter((i) => i.score >= cut).length;
  return { kept, of: FINDER_ITEMS.length, bestIou: kept ? Math.max(FINDER_BEST_IOU.loops_top, FINDER_BEST_IOU.left_grid) : 0, patternsFound: 0 };
}

// ---------- 4. the cheapest safe design ----------
export type Check = "none" | "same-model" | "independent";
export interface DesignOption { id: string; text: string; calls: number; check: Check; fallback: boolean; does: boolean }
export interface DesignStage { id: string; title: string; job: string; options: DesignOption[] }
export const STAGES: readonly DesignStage[] = [
  { id: "find", title: "Find things in a photo", job: "Suggest the objects in a player's photo without the player pointing at each one.", options: [
    { id: "top", text: "Take the finder's top outline", calls: 1, check: "none", fallback: false, does: true },
    { id: "score", text: "Keep the outline with the best score", calls: 1, check: "same-model", fallback: false, does: true },
    { id: "click", text: "Show the outlines; the player clicks one, or drags a box if it missed", calls: 1, check: "independent", fallback: true, does: true },
    { id: "vote", text: "Run the finder 3 times and vote", calls: 3, check: "same-model", fallback: false, does: true },
    { id: "box", text: "No model: the player drags every box", calls: 0, check: "independent", fallback: true, does: false },
  ] },
  { id: "lift", title: "Make a 3D object from a photo", job: "Give the player a textured object they can place on a course.", options: [
    { id: "mesh", text: "Use the lifted mesh as the collider", calls: 1, check: "none", fallback: false, does: true },
    { id: "twice", text: "Lift twice and keep the one the model likes more", calls: 2, check: "same-model", fallback: false, does: true },
    { id: "fit", text: "Lift once; collide with a plain fitted shape; flag lifts whose shape does not match the mask; retry or refuse", calls: 1, check: "independent", fallback: true, does: true },
    { id: "three", text: "Lift 3 times and vote", calls: 3, check: "same-model", fallback: false, does: true },
    { id: "plain", text: "No model: a plain grey box", calls: 0, check: "independent", fallback: true, does: false },
  ] },
  { id: "move", title: "Show a filmed move", job: "Turn a player's video into a clip the character plays.", options: [
    { id: "raw", text: "Play the motion as the model gives it", calls: 1, check: "none", fallback: false, does: true },
    { id: "judge", text: "Ask a second model if it looks real", calls: 2, check: "same-model", fallback: false, does: true },
    { id: "gate", text: "Plain physics checks (the plausibility gate); show it only if it passes, else say so", calls: 1, check: "independent", fallback: true, does: true },
    { id: "twice", text: "Measure the video twice and average", calls: 2, check: "same-model", fallback: false, does: true },
    { id: "stored", text: "No model: play one of our stored clips", calls: 0, check: "independent", fallback: true, does: false },
  ] },
];
export const stageById = (id: string): DesignStage => STAGES.find((s) => s.id === id)!;
/** Safe means: something that is not the same model checks the output, and there is a way out when it fails. */
export const isSafe = (o: DesignOption): boolean => o.check === "independent" && o.fallback;
export interface Verdict { status: "best" | "safe-costly" | "unsafe" | "no-job"; calls: number; extra: number; why: string }
/** The cheapest safe option that still does the job. */
export const cheapestSafe = (st: DesignStage): DesignOption => st.options.filter((o) => isSafe(o) && o.does).sort((a, b) => a.calls - b.calls)[0];
export function judge(stageId: string, optionId: string): Verdict {
  const st = stageById(stageId), o = st.options.find((x) => x.id === optionId)!, best = cheapestSafe(st);
  if (!o.does) return { status: "no-job", calls: o.calls, extra: 0, why: "It is cheap and safe, but it does not do the job: the player gets no help." };
  if (!isSafe(o)) return { status: "unsafe", calls: o.calls, extra: o.calls - best.calls, why: o.check === "none" ? "Nothing checks the answer, so a bad one reaches the player." : o.check === "same-model" ? "A model grading a model is not a check: it can be wrong the same way." : "There is no way out when it fails." };
  if (o.calls > best.calls) return { status: "safe-costly", calls: o.calls, extra: o.calls - best.calls, why: `Safe, but it costs ${o.calls - best.calls} more paid model call${o.calls - best.calls === 1 ? "" : "s"} than the cheapest safe design.` };
  return { status: "best", calls: o.calls, extra: 0, why: "Safe and as cheap as a safe design gets: one model proposes, something plain checks." };
}
/** All three stages answered with the cheapest safe option. */
export const allBest = (choice: Record<string, string | undefined>): boolean => STAGES.every((s) => !!choice[s.id] && judge(s.id, choice[s.id]!).status === "best");
export const totalCalls = (choice: Record<string, string | undefined>): number => STAGES.reduce((n, s) => n + (choice[s.id] ? s.options.find((o) => o.id === choice[s.id])!.calls : 0), 0);
export const OUR_DESIGN: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.id, cheapestSafe(s).id]));
