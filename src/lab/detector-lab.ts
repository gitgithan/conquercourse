// Lab 10: Evaluating a detector (CC-49 data). Pure functions over the recorded outputs of a part detector on hand-labelled objects.
// Nothing is run at play time: the detector's answers were recorded once, and the Lab only re-counts them under the player's choices.

export type Expected = "present" | "absent" | "unclear";
export interface DetectorCase { object: string; prompt: string; expected: Expected; areaShare: number; precision: number; recall: number; note?: string }
export interface DetectorData { objects: string[]; prompts: string[]; cases: DetectorCase[] }

export interface DetectorConfig {
  /** Prompt names the player asks for. */
  prompts: string[];
  /** The detector counts as "saying there is a part" when it painted more than this share of the object's surface. */
  claimMin: number;
  /** A claimed part counts as found only when this share of it lies inside the real hold (precision of the painted area). */
  insideMin: number;
  /** ... and it covers at least this share of the real hold (recall of the painted area). */
  coverMin: number;
}
export const DEFAULT_DETECTOR: DetectorConfig = { prompts: ["bar", "rail", "ledge", "step"], claimMin: 0.02, insideMin: 0.5, coverMin: 1 / 3 };

export type Outcome = "found" | "missed-silent" | "missed-wrong-place" | "made-up" | "correct-empty" | "not-scored";
export interface Judged extends DetectorCase { outcome: Outcome }

export function judge(c: DetectorCase, cfg: DetectorConfig): Outcome {
  if (c.expected === "unclear") return "not-scored";
  const claimed = c.areaShare > cfg.claimMin;
  if (c.expected === "absent") return claimed ? "made-up" : "correct-empty";
  if (!claimed) return "missed-silent";
  return c.precision >= cfg.insideMin && c.recall >= cfg.coverMin ? "found" : "missed-wrong-place";
}

export interface Tally {
  found: number; missed: number; madeUp: number; correctEmpty: number;
  /** Cases where a real part exists (found + missed). */
  real: number;
  /** Cases where no such part exists (made up + correct empty). */
  none: number;
  /** found / (found + madeUp): of the things it claimed, how many were real and in the right place. */
  precision: number;
  /** found / real: of the real parts, how many it found. */
  recall: number;
  f1: number;
}
export function tally(judged: Outcome[]): Tally {
  const n = (o: Outcome) => judged.filter((j) => j === o).length;
  const found = n("found"), missed = n("missed-silent") + n("missed-wrong-place"), madeUp = n("made-up"), correctEmpty = n("correct-empty");
  const precision = found + madeUp ? found / (found + madeUp) : 0;
  const recall = found + missed ? found / (found + missed) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { found, missed, madeUp, correctEmpty, real: found + missed, none: madeUp + correctEmpty, precision, recall, f1 };
}

export function evaluate(data: DetectorData, cfg: DetectorConfig): { rows: Judged[]; tally: Tally } {
  const rows = data.cases.filter((c) => cfg.prompts.includes(c.prompt)).map((c) => ({ ...c, outcome: judge(c, cfg) }));
  return { rows, tally: tally(rows.map((r) => r.outcome)) };
}

export interface CurvePoint { claimMin: number; tally: Tally }
/** The sliding threshold: the same counts at many values of the claim threshold. */
export function sweep(data: DetectorData, cfg: DetectorConfig, steps = 41, max = 0.8): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 0; i < steps; i++) {
    const claimMin = (i / (steps - 1)) * max;
    out.push({ claimMin, tally: evaluate(data, { ...cfg, claimMin }).tally });
  }
  return out;
}
export function bestF1(curve: CurvePoint[]): CurvePoint { return curve.reduce((b, p) => (p.tally.f1 > b.tally.f1 ? p : b), curve[0]); }

/** Which labelled parts are hard: the share of threshold settings at which the detector's call on that part is right. Lowest first. */
export function hardness(data: DetectorData, cfg: DetectorConfig, steps = 41, max = 0.8): { object: string; prompt: string; expected: Expected; rightShare: number; note?: string }[] {
  const pts = Array.from({ length: steps }, (_, i) => (i / (steps - 1)) * max);
  return data.cases.filter((c) => c.expected !== "unclear" && cfg.prompts.includes(c.prompt)).map((c) => {
    const right = pts.filter((claimMin) => { const o = judge(c, { ...cfg, claimMin }); return o === "found" || o === "correct-empty"; }).length;
    return { object: c.object, prompt: c.prompt, expected: c.expected, rightShare: right / steps, note: c.note };
  }).sort((a, b) => a.rightShare - b.rightShare || a.object.localeCompare(b.object));
}

/** Per prompt name: how it did, so the player can see which words work. */
export function byPrompt(data: DetectorData, cfg: DetectorConfig): { prompt: string; tally: Tally }[] {
  return data.prompts.map((p) => ({ prompt: p, tally: evaluate(data, { ...cfg, prompts: [p] }).tally }));
}
