// Lab 13 (Video to motion): the pure parts. The clips are recorded files; the gate, the smoothing and the clip reader are the game's own
// (src/lab/signal-lab.ts holds the TypeScript port of pipelines/ccpipe/gate.py that Lab 8 already checks against the Python gate).
import { parseClip, sampleClip, type Clip } from "../../motion/clip";
import { fixedSkeleton, filterFrames, gameSmoothing, runGate, failures, type Frames, type GateReport, type SignalClip } from "../../lab/signal-lab";
import { TICKS_PER_SECOND } from "../../sim/units";

export type Origin = "recorded-pass" | "recorded-fail" | "broken-by-us";
export interface LabClip { id: string; label: string; url: string; origin: Origin; note: string; breakWith?: Break; base?: string }
export type Break = "sink" | "teleport" | "slow" | "bones";

const M = "/assets/motion/", X = "/assets/experiments/";
export const LAB_CLIPS: LabClip[] = [
  { id: "run", label: "Run (motion capture)", url: `${M}run.json`, origin: "recorded-pass", note: "CMU motion capture, shipped." },
  { id: "leap", label: "Leap (motion capture)", url: `${M}leap.json`, origin: "recorded-pass", note: "CMU motion capture, shipped." },
  { id: "vault", label: "Vault (filmed, London Parkour)", url: `${M}vault.json`, origin: "recorded-pass", note: "Measured from a video, repaired, passed the gate, shipped." },
  { id: "roll-crouch", label: "Roll, crouch part (filmed)", url: `${X}mymove/roll-lp-crouch.json`, origin: "recorded-pass", note: "A trimmed piece of a filmed jump roll; it passes the gate." },
  { id: "roll-whole", label: "Roll, the whole film (filmed)", url: `${X}mymove/roll-lp-whole.json`, origin: "recorded-fail", note: "The whole 150-frame measurement of the jump roll. A real failure: the body is in the air but not on a falling arc." },
  { id: "wall-a", label: "Wall run-up, Kimodo sample a", url: `${X}starter-clips/wall_runup_grab_wall_a_s0.json`, origin: "recorded-fail", note: "A generated clip that says a wall holds the body, but the body hangs in the air more than a second with nothing holding it." },
  { id: "sink", label: "Run with feet under the floor (made by us)", url: `${M}run.json`, origin: "broken-by-us", breakWith: "sink", note: "The shipped run, every joint moved 8 cm down." },
  { id: "teleport", label: "Run with a jump in place (made by us)", url: `${M}run.json`, origin: "broken-by-us", breakWith: "teleport", note: "The shipped run, the body moved 1.5 m forward in one frame." },
  { id: "slow", label: "Leap on the wrong clock (made by us)", url: `${M}leap.json`, origin: "broken-by-us", breakWith: "slow", note: "The shipped leap with its frame rate typed as 15 instead of 30: the same joints, a clock that runs half as fast." },
  { id: "bones", label: "Vault with a stretching arm (made by us)", url: `${M}vault.json`, origin: "broken-by-us", breakWith: "bones", note: "The shipped vault with the left hand sliding away from the elbow by up to 25%." },
];

export const SINK_M = 0.08, JUMP_M = 1.5, SLOW_FPS = 15, STRETCH = 0.25;
const copy = (f: Frames): Frames => f.map((fr) => fr.map((p) => [...p]));

/** Break a recorded clip in one named way (the broken clips are made here, never recorded). */
export function breakClip(c: SignalClip, how: Break): SignalClip {
  const frames = copy(c.frames);
  const idx = (n: string) => c.names.indexOf(n);
  if (how === "sink") frames.forEach((fr) => fr.forEach((p) => { p[1] -= SINK_M; }));
  if (how === "teleport") { const k = Math.floor(frames.length / 2); for (let t = k; t < frames.length; t++) frames[t].forEach((p) => { p[2] += JUMP_M; }); }
  if (how === "bones") {
    const e = idx("LeftForeArm"), hand = ["LeftHand", "LeftHandThumbEnd", "LeftHandMiddleEnd"].map(idx);
    frames.forEach((fr, t) => { const s = 1 + STRETCH * Math.sin((Math.PI * t) / (frames.length - 1)); for (const j of hand) for (let a = 0; a < 3; a++) fr[j][a] = fr[e][a] + (fr[j][a] - fr[e][a]) * s; });
  }
  return { ...c, fps: how === "slow" ? SLOW_FPS : c.fps, frames };
}

export function buildClip(spec: LabClip, files: Record<string, SignalClip>): SignalClip {
  const raw = files[spec.url];
  return spec.breakWith ? breakClip(raw, spec.breakWith) : raw;
}

/** The repair the pipeline allows for a sunk foot: a frame with a joint under the floor is raised until its lowest joint touches (repairs.py lift_to_floor). */
export function liftToFloor(f: Frames, floor = 0): { frames: Frames; changed: number } {
  const out = copy(f); let changed = 0;
  for (const fr of out) { const low = Math.min(...fr.map((p) => p[1])); if (low < floor) { changed++; for (const p of fr) p[1] += floor - low; } }
  return { frames: out, changed };
}

// ---------- step 1: one clock ----------
/** The time of frame i comes from the source rate: i / fps. */
export const frameTime = (i: number, fps: number): number => i / fps;
export const clipSeconds = (c: { frames: unknown[]; fps: number }): number => (c.frames.length - 1) / c.fps;
/** The same joints under another typed frame rate: only the clock changes. */
export const withFps = (c: SignalClip, fps: number): SignalClip => ({ ...c, fps });
/** How far a typed rate puts the clock off, in percent (positive = the clip plays too slowly). */
export const clockOffPercent = (realFps: number, typedFps: number): number => (realFps / typedFps - 1) * 100;

// ---------- step 2: joint positions, names == array length ----------
export interface Shape { ok: boolean; message: string }
export function checkShape(raw: unknown): Shape {
  try { parseClip(structuredClone(raw)); return { ok: true, message: "Every frame has one position per name." }; }
  catch (e) { return { ok: false, message: (e as Error).message }; }
}
/** The clip with its last joint name removed: the off-by-one mistake the check exists for. */
export const dropLastName = (c: SignalClip): unknown => ({ ...c, names: c.names.slice(0, -1), parents: c.parents.slice(0, -1) });
export const dropLastNameOnly = (c: SignalClip): unknown => ({ ...c, names: c.names.slice(0, -1) });

// ---------- step 3: smoothing (Lab 8 teaches the price; here only what the game applies) ----------
export function applyGameSmoothing(c: SignalClip): SignalClip { return { ...c, frames: gameSmoothing(c) }; }
export const onlyBoneLengths = (c: SignalClip): SignalClip => ({ ...c, frames: fixedSkeleton(c.frames, c.parents) });
export { filterFrames };

// ---------- step 4: the gate ----------
export const RULE_WORDS: Record<string, string> = {
  knees_bend_forward: "Knees bend forward", legs_not_twisted: "Legs not twisted", knees_within_range: "Knees bend a possible amount", flight_is_ballistic: "A jump follows gravity",
  held_clips_are_held: "Something holds the body", feet_dont_sink: "Feet stay above the floor", no_teleport: "No sudden jumps in place", bones_keep_length: "Bones keep their length",
  feet_dont_slide: "Planted feet do not slide", no_jitter: "No jitter (peak acceleration)",
};
export interface Verdict { id: string; origin: Origin; pass: boolean; failed: string[]; softFailed: string[]; report: GateReport }
export function verdict(spec: LabClip, c: SignalClip): Verdict {
  const report = runGate(c);
  return { id: spec.id, origin: spec.origin, pass: report.pass, failed: failures(report), softFailed: Object.entries(report.soft).filter(([, v]) => !v.ok).map(([k]) => k), report };
}
/** One sentence a player can follow for the first hard rule that failed. */
export function whyFailed(v: Verdict): string {
  const k = v.failed[0], r = k ? v.report.hard[k] : null;
  if (!k || !r) return "";
  const val = r.value;
  switch (k) {
    case "feet_dont_sink": return `The lowest foot point is ${((val ?? 0) * 100).toFixed(1)} cm under the floor (the limit is 3 cm).`;
    case "no_teleport": return `The hips move ${(val ?? 0).toFixed(1)} m/s between two frames (the limit is 12 m/s): a person cannot do that.`;
    case "flight_is_ballistic": return `In the air the body falls with ${(val ?? 0).toFixed(2)} m/s2; the Earth's is 9.81 (we allow 15% either way).`;
    case "held_clips_are_held": return `The body hangs ${(val ?? 0).toFixed(2)} s in the air with nothing holding it (the limit is 1 s).`;
    default: return `${RULE_WORDS[k]}: ${val}, limit ${r.limit}.`;
  }
}

// ---------- step 5: retarget ----------
/** The factor that makes the clip's legs as long as the character's legs (what the Rookie view applies to every joint). */
export const retargetScale = (rookieLeg: number, clipLeg: number): number => rookieLeg / clipLeg;

// ---------- step 6: the one clock in the game ----------
export const tickSeconds = (tick: number): number => tick / TICKS_PER_SECOND;
/** The clip frame the game shows at a simulator tick: the clock is the tick count, never a timer. */
export const clipFrameAtTick = (tick: number, fps: number): number => tickSeconds(tick) * fps;
export function poseAtTick(c: Clip, tick: number): number[][] { return sampleClip(c, tickSeconds(tick), false); }
export const ticksFor = (c: { frames: unknown[]; fps: number }): number => Math.ceil(clipSeconds(c) * TICKS_PER_SECOND);
