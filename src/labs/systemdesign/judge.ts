// Lab 18: the judge. A rule engine built from OUR lessons (docs/lessons.md), deterministic, no model. Like the simulator, it is the truth for facts.
import { BLOCKS, blockById, type Block } from "./blocks";

export type Level = "result" | "message" | "broken";
export interface Scenario { id: string; title: string; ask: string; volume: number; budget?: number; rules: string[]; jobs?: string[] }
export interface RuleResult { id: string; lesson: string; state: "pass" | "fail" | "na"; why: string; source: string }
export interface Meters { costPer1000: number; monthly: number; unmeasured: boolean; warm: number; coldExtra: number; privacy: number; coverage: number; uncovered: string[] }
export interface Check { text: string; ok: boolean }
export interface Verdict { rules: RuleResult[]; meters: Meters; checks: Check[]; cleared: boolean; lessonsPassed: number; lessonsTotal: number }

export const SCENARIOS: readonly Scenario[] = [
  { id: "photo", title: "A photo with a face in it", ask: "A player uploads a photo. A face is in it. Build the service that turns it into a course object.", volume: 1000, rules: ["keys", "mask", "safety", "contributor", "limits", "skin", "simtruth"] },
  { id: "free", title: "10,000 players, free budget", ask: "10,000 objects a month and at most $150 a month. Build it so the bill stays small.", volume: 10000, budget: 150, rules: ["keys", "safety", "limits", "ondemand", "mask"] },
  { id: "down", title: "The GPU model is down", ask: "A GPU model stops answering. Build it so the player is never left hanging. Press Play failure.", volume: 1000, rules: ["keys", "fallback", "safety"] },
  { id: "models", title: "Pick the model for each job", ask: "Four jobs: blur people, cut the object out, lift it to 3D, check the photo is safe. Pick one right model for each, and no extras.", volume: 1000, rules: ["keys", "contributor", "jobs"], jobs: ["blur", "cutout", "lift", "safety"] },
];
export const scenarioById = (id: string): Scenario => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

const GPU_PAID = ["sam3", "sam3d", "alwayson", "vultr", "kimodo", "museimage"];
const PHOTO_MODELS = ["sam3", "sam3d", "alwayson", "vultr"];
const PAID_ANY = ["safety", "safety-meta", ...GPU_PAID];
const idx = (ids: string[], list: string[]): number => { const i = ids.findIndex((x) => list.includes(x)); return i; };
const has = (ids: string[], id: string): boolean => ids.includes(id);

/** What the player sees when one block is down. */
export function failureOutcome(ids: string[], failed: string): { level: Level; sees: string } {
  const b = blockById(failed);
  if (!b) return { level: "broken", sees: "Nothing is known about this block." };
  const library = has(ids, "library"), queue = has(ids, "queue");
  switch (b.fail) {
    case "gpu":
      if (library) return { level: "result", sees: "A ready-made object from the library shows up, with a note that making your own is off right now." };
      if (queue) return { level: "message", sees: "After the wait the page says in plain words that the object could not be made, and offers to try again." };
      return { level: "broken", sees: "The spinner never stops. Nothing tells the player the job died." };
    case "safety":
      if (has(ids, "secondhost")) return { level: "result", sees: "The check runs on the second host. It is a bit slower, and the player gets the object." };
      if (has(ids, "functions")) return { level: "message", sees: "The server fails closed: the photo is not used, and the page says the check could not run. Try again later." };
      return { level: "broken", sees: "Nobody decides, so the photo is either stuck or let through unchecked." };
    case "door":
      return library ? { level: "result", sees: "The page still works. Ready-made objects play; making your own is off." } : { level: "message", sees: "The page shows a network error. Playing saved objects still works." };
    case "db":
      return { level: "message", sees: "Sharing is off for now. Play and the objects saved in the browser still work." };
    case "host":
      return { level: "broken", sees: "The whole site is down. Nothing in this design can help. We accept this: the host runs on a worldwide network." };
    default:
      return { level: "result", sees: "This block does not fail the way a server does." };
  }
}

const rule = (id: string, lesson: string, source: string, state: RuleResult["state"], why: string): RuleResult => ({ id, lesson, state, why, source });

export function judge(scenarioId: string, ids: string[]): Verdict {
  const sc = scenarioById(scenarioId);
  const bl = ids.map((i) => blockById(i)).filter((b): b is Block => !!b);
  const firstPaid = idx(ids, [...PAID_ANY, "mask"]);
  const firstGpu = idx(ids, GPU_PAID);
  const firstPhotoModel = idx(ids, PHOTO_MODELS);
  const all: Record<string, RuleResult> = {};

  // keys stay on the server
  { const L = "Keys stay out of the browser.", S = "docs/lessons.md";
    if (has(ids, "keyinpage")) all.keys = rule("keys", L, S, "fail", "The key ships inside the page, so anyone can copy it and spend the credit.");
    else if (firstPaid < 0) all.keys = rule("keys", L, S, "pass", "Nothing here needs a key.");
    else { const f = ids.indexOf("functions"); all.keys = f >= 0 && f < firstPaid ? rule("keys", L, S, "pass", "A server door sits before the first model, so only it holds the keys.") : rule("keys", L, S, "fail", "A model is called with no server door before it, so there is nowhere safe to keep the key."); } }
  // mask first
  { const L = "Mask faces before a cut-out or lift model sees the photo.", S = "docs/lessons.md";
    if (firstPhotoModel < 0) all.mask = rule("mask", L, S, "na", "No cut-out or lift model here.");
    else { const m = ids.indexOf("mask"); all.mask = m < 0 ? rule("mask", L, S, "fail", "The photo reaches a model with the face still in it.") : m < firstPhotoModel ? rule("mask", L, S, "pass", "People are blurred before the first model.") : rule("mask", L, S, "fail", "A model sees the photo before the mask runs."); } }
  // safety before GPU
  { const L = "The safety check runs before any GPU is paid.", S = "docs/pipelines.md section 12";
    if (firstGpu < 0) all.safety = rule("safety", L, S, "na", "No paid GPU here.");
    else { const s = idx(ids, ["safety", "safety-meta"]); all.safety = s < 0 ? rule("safety", L, S, "fail", "The check is skipped, so a bad photo costs GPU money and may be used.") : s < firstGpu ? rule("safety", L, S, "pass", "A bad photo stops before any GPU is paid.") : rule("safety", L, S, "fail", "The GPU runs first, so a refused photo is already paid for."); } }
  // contributor
  { const L = "Never send private data to a contributor model.", S = "docs/lessons.md";
    all.contributor = has(ids, "safety-meta") ? rule("contributor", L, S, "fail", "Meta may train on what a contributor model is sent, and this one is sent the player's photo.") : rule("contributor", L, S, "pass", "No contributor model gets a photo."); }
  // limits
  { const L = "Cap the jobs before money is spent.", S = "docs/pipelines.md section 12";
    if (firstPaid < 0) all.limits = rule("limits", L, S, "na", "Nothing paid here.");
    else { const l = ids.indexOf("limits"); all.limits = l >= 0 && l < idx(ids, PAID_ANY) ? rule("limits", L, S, "pass", "A cap stands before the first paid call.") : rule("limits", L, S, "fail", "One visitor can run up the bill: no cap before the first paid call."); } }
  // on demand
  { const L = "Pay for a GPU only while a job runs.", S = "docs/pipelines.md section 12 (Pitfalls)";
    all.ondemand = has(ids, "alwayson") || has(ids, "vultr") ? rule("ondemand", L, S, "fail", "A machine kept on costs every hour, used or not.") : rule("ondemand", L, S, "pass", "GPUs wake for a job and sleep after."); }
  // skin not collider
  { const L = "A photo becomes a skin, never a collider.", S = "docs/lessons.md";
    const lifted = ids.some((i) => blockById(i)?.job === "lift");
    if (has(ids, "meshcollider")) all.skin = rule("skin", L, S, "fail", "The noisy mesh is used as the collider.");
    else if (!lifted) all.skin = rule("skin", L, S, "na", "No lift here.");
    else { const lf = Math.max(...ids.map((i, k) => (blockById(i)?.job === "lift" ? k : -1))); all.skin = ids.indexOf("fitcollider") > lf ? rule("skin", L, S, "pass", "A clean fitted collider comes after the lift.") : rule("skin", L, S, "fail", "A lift is made but no clean collider is fitted after it."); } }
  // simulator is truth
  { const L = "The simulator is truth.", S = "docs/lessons.md, docs/model-limits.md";
    if (has(ids, "modeljudge")) all.simtruth = rule("simtruth", L, S, "fail", "An AI is asked if the course clears. Only 33 of 100 asked layouts cleared in the simulator.");
    else all.simtruth = has(ids, "sim") ? rule("simtruth", L, S, "pass", "The simulator decides what can be cleared.") : rule("simtruth", L, S, "fail", "Nothing proves that the object can be played."); }
  // gate for motion
  { const L = "Nothing is shown before it passes the gate.", S = "CLAUDE.md";
    if (!has(ids, "kimodo")) all.gate = rule("gate", L, S, "na", "No motion here.");
    else all.gate = ids.indexOf("gate") > ids.indexOf("kimodo") ? rule("gate", L, S, "pass", "Motion is checked before it is shown.") : rule("gate", L, S, "fail", "Generated motion goes to the player unchecked."); }
  // fallback
  const points = bl.filter((b) => b.fail !== "none");
  const outcomes = points.map((b) => ({ b, o: failureOutcome(ids, b.id) }));
  const coverage = points.length ? Math.round((outcomes.filter((x) => x.o.level !== "broken").length / points.length) * 100) : 100;
  const brokenBlocks = outcomes.filter((x) => x.o.level === "broken");
  { const L = "When a model is down the player still gets something.", S = "docs/pipelines.md section 12";
    const gpus = outcomes.filter((x) => x.b.fail === "gpu" || x.b.fail === "safety");
    all.fallback = !gpus.length ? rule("fallback", L, S, "na", "No model block to fail.") : gpus.some((x) => x.o.level === "broken") ? rule("fallback", L, S, "fail", `If ${gpus.find((x) => x.o.level === "broken")!.b.name} is down, the player is left hanging.`) : rule("fallback", L, S, "pass", "Every model block has a plain answer when it fails."); }
  // jobs
  { const L = "One right model for each job, and no extras.", S = "docs/model-ledger.md";
    const need = sc.jobs ?? [];
    const missing = need.filter((j) => !bl.some((b) => b.job === j && !b.contributor));
    const extra = bl.filter((b) => b.paid && b.job && !need.includes(b.job));
    all.jobs = !need.length ? rule("jobs", L, S, "na", "This scenario names no jobs.") : missing.length ? rule("jobs", L, S, "fail", `No right model yet for: ${missing.join(", ")}.`) : extra.length ? rule("jobs", L, S, "fail", `${extra[0].name} does a job nobody asked for, and it costs money.`) : rule("jobs", L, S, "pass", "Every job has a model that does that job, and nothing else is paid."); }

  const rules = [...sc.rules, "gate"].filter((r, k, a) => a.indexOf(r) === k).map((r) => all[r]).filter((r) => r.state !== "na" || sc.rules.includes(r.id));
  const lessonsTotal = rules.filter((r) => r.state !== "na").length;
  const lessonsPassed = rules.filter((r) => r.state === "pass").length;

  const perObject = bl.reduce((s, b) => s + b.perObject, 0), monthlyFixed = bl.reduce((s, b) => s + b.monthly, 0);
  const monthly = Math.round((perObject * sc.volume + monthlyFixed) * 100) / 100;
  const coldBlocks = bl.filter((b) => b.cold > 0);
  const privacy = Math.min(100, (all.mask.state === "fail" ? 50 : 0) + (all.contributor.state === "fail" ? 40 : 0) + (has(ids, "keyinpage") ? 10 : 0));
  const meters: Meters = {
    costPer1000: Math.round((perObject * 1000 + (monthlyFixed / sc.volume) * 1000) * 100) / 100, monthly, unmeasured: bl.some((b) => b.unmeasured),
    warm: Math.round(bl.reduce((s, b) => s + b.latency, 0) * 10) / 10, coldExtra: has(ids, "warm") ? 0 : coldBlocks.reduce((s, b) => s + b.cold, 0),
    privacy, coverage, uncovered: brokenBlocks.map((x) => x.b.name),
  };

  const ok = (id: string): boolean => all[id]?.state !== "fail";
  const checks: Check[] = [];
  const need = (text: string, v: boolean) => checks.push({ text, ok: v });
  if (sc.id === "photo") {
    need("No key in the page", ok("keys") && has(ids, "functions")); need("Blur before cut-out and lift", all.mask.state === "pass"); need("Safety check before the first GPU", all.safety.state === "pass");
    need("No contributor model sees the photo", all.contributor.state === "pass" && (has(ids, "safety"))); need("Collider is fitted, not the mesh", all.skin.state === "pass"); need("The simulator decides", all.simtruth.state === "pass"); need("A cap before money is spent", all.limits.state === "pass");
  } else if (sc.id === "free") {
    need("Hosted on a free static host", has(ids, "pages") && !has(ids, "vultr")); need(`Bill at most $${sc.budget} a month (now $${monthly})`, monthly <= sc.budget! && has(ids, "sam3") && ids.some((i) => blockById(i)?.job === "lift"));
    need("No GPU kept on", all.ondemand.state === "pass"); need("A cap before money is spent", all.limits.state === "pass"); need("Key stays on the server", ok("keys") && has(ids, "functions")); need("Safety check before the GPU", all.safety.state === "pass");
  } else if (sc.id === "down") {
    const lift = bl.find((b) => b.job === "lift"), cut = bl.find((b) => b.job === "cutout");
    need("A cut-out and a lift are in the design", !!lift && !!cut); need("Nothing leaves the player hanging", all.fallback.state === "pass");
    need("The player still gets an object when the lift is down", !!lift && failureOutcome(ids, lift.id).level === "result"); need("A failed safety check never lets a photo through", has(ids, "safety") && failureOutcome(ids, "safety").level !== "broken"); need("Key stays on the server", ok("keys") && has(ids, "functions"));
  } else {
    for (const j of sc.jobs ?? []) need(`A right model for: ${j}`, bl.some((b) => b.job === j && !b.contributor)); need("No extra paid model", all.jobs.state === "pass"); need("No contributor model", all.contributor.state === "pass"); need("Key stays on the server", ok("keys") && has(ids, "functions"));
  }
  return { rules, meters, checks, cleared: checks.every((c) => c.ok), lessonsPassed, lessonsTotal };
}

/** The real game's photo-to-object design, in order (docs/pipelines.md section 12). */
export const REAL: readonly string[] = ["pages", "browser", "functions", "limits", "safety", "warm", "queue", "mask", "sam3", "sam3d", "bake", "fitcollider", "sim", "keep", "d1", "library"];
export const REAL_WHY: Record<string, string> = {
  pages: "Free, always on, $0 (docs/deploy.md).", browser: "The simulator and saved objects live here, so judging costs nothing.", functions: "Every key lives here only (lessons).",
  limits: "6 jobs in 10 minutes, 3 a day per player, 100 a day for the game.", safety: "Muse Spark Open on Baseten, on a 640 px copy, before any GPU. Fails closed.",
  warm: "Hides the 14 s and 46 s cold starts.", queue: "Start, then poll; gives up after about 20 minutes with a plain message.", mask: "Blurs people inside the GPU job before SAM 3 sees the photo.",
  sam3: "Meta's SAM 3 on an L4: about $0.0006 a run.", sam3d: "Meta's SAM 3D Objects on an L40S: about $0.006 a lift.", bake: "A 1024 texture fixes smeared colour.",
  fitcollider: "Photo is a skin; physics gets a few clean numbers.", sim: "The simulator is truth.", keep: "Saved in the browser with a credit record; no photo kept.",
  d1: "Share links and switches only.", library: "19 shipped objects when making your own is off.",
};
export const REAL_NOTE = "One honest trade-off: the safety check sees a small copy of the photo before the mask. We chose it so an unsafe photo stops before any GPU is paid. The check runs on a hosted open model, not a contributor model.";
export function diffFromReal(ids: string[]): { missing: string[]; extra: string[] } {
  return { missing: REAL.filter((r) => !ids.includes(r)), extra: ids.filter((i) => !REAL.includes(i)) };
}
export { BLOCKS };
