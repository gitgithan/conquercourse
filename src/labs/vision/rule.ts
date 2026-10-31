// Lab 4 (Computer vision): the keep-or-drop rule for a street photo, and the sweep over its thresholds.
// This is the same rule as scripts/photos_mask.py (a photo is usable when little of it is masked and no person is huge),
// with the person detector's raw finds as input so the thresholds can move. scripts/lab_vision_rule.py is the same rule in Python;
// tests/lab-vision.test.ts checks that both give the same counts on the shipped table.

/** One thing the detector called a person: its score, its box and its grown mask, each as a share of the photo. */
export interface Find { score: number; box: number; mask: number }
/** One person a human labelled: size as a share of the photo, and which find (index) matched it, or -1 when the detector found nothing there. */
export interface Truth { size: number; find: number }
export interface Photo { id: string; finds: Find[]; truth: Truth[]; unionMask30: number }

export interface Rule {
  /** Ignore finds scored below this. */
  scoreCut: number;
  /** Ignore finds whose box is smaller than this share of the photo (those people are left unmasked). */
  minSize: number;
  /** Drop the photo when more than this share of it is masked. */
  maxMasked: number;
}

/** The game's own rule: score 0.3, every size, 15 percent masked. A person box over 25 percent of the photo always drops it. */
export const OURS: Rule = { scoreCut: 0.3, minSize: 0, maxMasked: 0.15 };
export const MAX_BOX = 0.25;

export interface PhotoResult { kept: boolean; masked: number; active: boolean[]; people: number; covered: number; missed: number; falseMasks: number }

export function judgePhoto(p: Photo, r: Rule): PhotoResult {
  const active = p.finds.map((f) => f.score >= r.scoreCut && f.box >= r.minSize);
  let masked = 0, biggest = 0;
  p.finds.forEach((f, i) => { if (active[i]) { masked += f.mask; if (f.box > biggest) biggest = f.box; } });
  if (masked > 1) masked = 1;
  const kept = masked <= r.maxMasked && biggest <= MAX_BOX;
  const matched = new Set<number>();
  let covered = 0;
  for (const t of p.truth) { if (t.find >= 0) matched.add(t.find); if (t.find >= 0 && active[t.find]) covered++; }
  let falseMasks = 0;
  p.finds.forEach((_, i) => { if (active[i] && !matched.has(i)) falseMasks++; });
  return { kept, masked, active, people: p.truth.length, covered, missed: p.truth.length - covered, falseMasks };
}

export interface Summary {
  photos: number; kept: number; keptShare: number;
  /** People a human labelled in the kept photos, and how many of those the rule left unmasked. */
  people: number; covered: number; missed: number; missedShare: number;
  /** Masks drawn in kept photos that sit on no labelled person. */
  falseMasks: number;
  /** covered / (covered + false masks), and covered / people. */
  precision: number; recall: number;
  /** Free-response ROC point: false masks per kept photo against recall. */
  falsePerPhoto: number;
}

export function summarize(photos: Photo[], r: Rule): Summary {
  let kept = 0, people = 0, covered = 0, falseMasks = 0;
  for (const p of photos) {
    const j = judgePhoto(p, r);
    if (!j.kept) continue;
    kept++; people += j.people; covered += j.covered; falseMasks += j.falseMasks;
  }
  const div = (a: number, b: number) => (b > 0 ? a / b : 1);
  return {
    photos: photos.length, kept, keptShare: div(kept, photos.length),
    people, covered, missed: people - covered, missedShare: people > 0 ? (people - covered) / people : 0,
    falseMasks, precision: div(covered, covered + falseMasks), recall: div(covered, people),
    falsePerPhoto: kept > 0 ? falseMasks / kept : 0,
  };
}

export type Knob = keyof Rule;
export const KNOBS: Record<Knob, { label: string; min: number; max: number; step: number }> = {
  scoreCut: { label: "Score cut", min: 0.05, max: 0.95, step: 0.05 },
  minSize: { label: "Smallest person to mask", min: 0, max: 0.05, step: 0.0025 },
  maxMasked: { label: "Most of a photo that may be masked", min: 0, max: 0.5, step: 0.01 },
};

/** Move one knob across its whole range with the others held; each point is a summary. */
export function sweep(photos: Photo[], base: Rule, knob: Knob): { value: number; s: Summary }[] {
  const { min, max, step } = KNOBS[knob];
  const n = Math.round((max - min) / step);
  const out: { value: number; s: Summary }[] = [];
  for (let i = 0; i <= n; i++) {
    const value = Math.round((min + i * step) * 1e6) / 1e6;
    out.push({ value, s: summarize(photos, { ...base, [knob]: value }) });
  }
  return out;
}

/**
 * The table text: one photo per line, `id|u30|score,box,mask;...|size,find;...`. Numbers are the rounded values the Python rule reads as well.
 * Lines starting with # are comments.
 */
export function parseTable(text: string): Photo[] {
  const photos: Photo[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [id, u, f, t] = line.split("|");
    photos.push({
      id, unionMask30: Number(u),
      finds: f ? f.split(";").map((s) => { const [score, box, mask] = s.split(",").map(Number); return { score, box, mask }; }) : [],
      truth: t ? t.split(";").map((s) => { const [size, find] = s.split(",").map(Number); return { size, find }; }) : [],
    });
  }
  return photos;
}
