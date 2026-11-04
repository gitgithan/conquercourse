// Lab 18 (System design), the block board: nine slots of OUR real pipeline, each with three blocks that could fit.
// score() is pure and deterministic (no model, no clock): the same choices always give the same meters.
// Numbers: the cut-out and lift seconds and prices are the Lab's recorded data (blocks.ts, from docs/model-limits.md); a number we never recorded is marked `est`.
import { blockById } from "./blocks";

export type SlotId = "photo" | "find" | "lift" | "place" | "wait" | "collider" | "sim" | "search" | "share";
export type MeterId = "time" | "same" | "cost" | "privacy" | "offline" | "smooth" | "shape" | "places";
export type Design = Record<SlotId, string>;
export type BriefId = "online" | "kiosk";

export interface Hint { lab: string; labText: string; why: string }
export interface PBlock {
  id: string; slot: SlotId; name: string; plain: string;
  /** Seconds it adds to the first result when warm. */
  secs: number;
  /** Extra seconds the first visitor waits when the machine is asleep. */
  cold: number;
  /** Dollars for 1,000 objects. */
  cost: number;
  /** Dollars a month whatever the traffic. */
  monthly: number;
  /** 0 to 3: how much can go wrong, with the plain words for it. */
  risk: 0 | 1 | 2 | 3; riskText: string;
  /** Numbers we never recorded. */
  est?: boolean;
  /** Lesson from an earlier Lab (only for a block that can be a misfit). */
  hint?: Hint;
}

export const SLOTS: readonly { id: SlotId; stage: string; title: string; ask: string }[] = [
  { id: "photo", stage: "Photo or map place", title: "The picture", ask: "What do we keep of the street photo?" },
  { id: "find", stage: "Find objects", title: "Find the object", ask: "What finds the bars, the wall, the rail?" },
  { id: "lift", stage: "Lift to 3D", title: "Lift to 3D", ask: "How does a flat picture get a size in 3D?" },
  { id: "place", stage: "Where the models run", title: "When the models run", ask: "Run the models when asked, or ahead of time?" },
  { id: "wait", stage: "While you wait", title: "The waiting", ask: "What does the player see while a model works?" },
  { id: "collider", stage: "Fit a collider", title: "The collider", ask: "What shape does the physics touch?" },
  { id: "sim", stage: "Simulate", title: "The simulator", ask: "How does a run play out?" },
  { id: "search", stage: "Search the ideal run", title: "The search", ask: "How do we find a run that clears it?" },
  { id: "share", stage: "Show and share", title: "Share a run", ask: "What do we send to a friend?" },
];

const FINDER = blockById("sam3")!, LIFT = blockById("sam3d")!, ALWAYS = blockById("alwayson")!;
const k = (perObject: number): number => Math.round(perObject * 1000 * 100) / 100; // dollars per 1,000 objects

const B = (b: Omit<PBlock, "monthly" | "cold"> & { monthly?: number; cold?: number }): PBlock => ({ monthly: 0, cold: 0, ...b });
export const PBLOCKS: readonly PBlock[] = [
  // the picture
  B({ id: "store", slot: "photo", name: "Store every photo", plain: "Keep the full picture on our disk.", secs: 0.1, cost: 1.2, est: true, risk: 3, riskText: "faces kept on our disk",
    hint: { lab: "lab-vision", labText: "You hid the people before anything else saw the photo.", why: "Keep only a blurred small copy, or link the live photo and keep nothing. Then no face is ever stored." } }),
  B({ id: "link", slot: "photo", name: "Link the live street photo", plain: "Show their photo from their site. Keep nothing.", secs: 0.6, cost: 0, risk: 1, riskText: "needs internet",
    hint: { lab: "lab-limits", labText: "Anything you must reach over the internet can be missing.", why: "A blurred small copy lives on the device, so it works with no internet at all." } }),
  B({ id: "blur", slot: "photo", name: "Keep a blurred small copy", plain: "Blur faces first, then keep a small copy.", secs: 1.2, cost: 0.3, est: true, risk: 1, riskText: "blur must work" }),
  // find
  B({ id: "rule", slot: "find", name: "Colour and edge rule", plain: "A hand-made rule: this colour, this edge.", secs: 0.2, cost: 0, risk: 2, riskText: "misses and mixes up",
    hint: { lab: "lab-detector", labText: "A weak finder misses things, and a score shows how often.", why: "The cut-out model finds the object's real outline. A fitted collider needs a real outline to start from." } }),
  B({ id: "cutout", slot: "find", name: "Cut-out model (SAM 3)", plain: "A model made to cut one object out of a photo.", secs: FINDER.latency, cold: FINDER.cold, cost: k(FINDER.perObject), risk: 1, riskText: "sleeps between jobs" }),
  B({ id: "chat", slot: "find", name: "Ask a chat model", plain: "Describe the photo in words and trust the answer.", secs: 6, cost: 3, est: true, risk: 3, riskText: "sends the photo out; may guess",
    hint: { lab: "lab-limits", labText: "A chat model can guess wrong, and a guess cannot be proven.", why: "The cut-out model does exactly this one job, runs on our own side, and keeps the photo away from outside hands." } }),
  // lift
  B({ id: "sprite", slot: "lift", name: "Flat picture, no 3D", plain: "Use the cut-out as a flat sticker.", secs: 0, cost: 0, risk: 2, riskText: "nothing to climb",
    hint: { lab: "lab-camera", labText: "One flat photo cannot say how far each part is.", why: "The 3D lift guesses the depth, so the obstacle gets a real size to stand on or hang from." } }),
  B({ id: "ondemand", slot: "lift", name: "Lift model that wakes per job", plain: "A GPU wakes for each job and sleeps again.", secs: LIFT.latency, cold: LIFT.cold, cost: k(LIFT.perObject), risk: 1, riskText: "slow first wake-up" }),
  B({ id: "alwayson", slot: "lift", name: "GPU kept on all month", plain: "Never sleeps, so no wake-up wait.", secs: ALWAYS.latency, cost: 0, monthly: ALWAYS.monthly, risk: 0, riskText: "you pay even when nobody plays",
    hint: { lab: "lab-wait", labText: "Waking the machine early hides the slow start, so you do not pay for it to sleep.", why: "The on-demand lift costs cents per job. Add the early wake-up in the waiting slot to hide its slow first start." } }),
  // when the models run
  B({ id: "runtime", slot: "place", name: "Run the models when asked", plain: "Each new photo goes to the models while the player waits.", secs: 0, cost: 0, risk: 1, riskText: "needs internet",
    hint: { lab: "lab-limits", labText: "Anything that runs at play time can be down or not reachable.", why: "Run the models once at build time. The finished files ship with the game, so nothing is asked for at play time." } }),
  B({ id: "build", slot: "place", name: "Run once at build time", plain: "Make the objects ahead of time and ship the files.", secs: 0.3, cost: 0, risk: 1, riskText: "only places we prepared",
    hint: { lab: "lab-lift", labText: "The lifts you saw there were made ahead of time, from photos we chose.", why: "A brand new player photo has no ready file, so the models must run when asked. Pre-run the common places to save money." } }),
  B({ id: "hybrid", slot: "place", name: "Pre-run common places only", plain: "Common places are ready; new ones run when asked.", secs: 0, cost: 0, est: true, risk: 1, riskText: "new places still wait",
    hint: { lab: "lab-limits", labText: "Anything that runs at play time can be down or not reachable.", why: "With no internet only the ready places work. To work everywhere offline, make every object ahead of time." } }),
  // waiting
  B({ id: "block", slot: "wait", name: "Freeze the page until done", plain: "Do the work on the main thread.", secs: 0, cost: 0, risk: 3, riskText: "page looks dead",
    hint: { lab: "lab-wait", labText: "A frozen page feels longer than a busy one.", why: "Do the work off the main thread, show progress, and wake the GPU while the player is still choosing." } }),
  B({ id: "progress", slot: "wait", name: "Progress bar and a worker", plain: "The page stays alive while the work runs.", secs: 0, cost: 0, risk: 1, riskText: "first visitor still waits",
    hint: { lab: "lab-wait", labText: "Progress hides some of the wait, but not a machine that is still asleep.", why: "Also wake the GPU early, while the player is picking the photo, so the slow start is over before they press go." } }),
  B({ id: "warmup", slot: "wait", name: "Progress plus an early wake-up", plain: "Wake the GPU while the player picks.", secs: 0, cost: 0.05, est: true, risk: 0, riskText: "a few idle seconds paid" }),
  // collider
  B({ id: "skin", slot: "collider", name: "Raw lifted skin mesh", plain: "Physics touches every noisy triangle.", secs: 3, cost: 0, est: true, risk: 3, riskText: "different on each lift",
    hint: { lab: "lab-collision", labText: "A second lift of the same photo moved the skin, and the run changed with it.", why: "A fitted box row snaps to a clean grid, so a noisy lift still gives the same run, and it has far fewer shapes to test." } }),
  B({ id: "hull", slot: "collider", name: "Convex hull", plain: "One smooth blob around the whole object.", secs: 0.3, cost: 0, risk: 2, riskText: "fills the gaps",
    hint: { lab: "lab-collision", labText: "The gaps between the bars are the whole obstacle.", why: "A fitted box row keeps each bar and each gap, so the player can still reach through. A hull turns them into a wall." } }),
  B({ id: "box", slot: "collider", name: "Fitted box row", plain: "A few clean boxes, one per bar.", secs: 0.2, cost: 0, risk: 0, riskText: "needs a good outline" }),
  // simulator
  B({ id: "frame", slot: "sim", name: "Step by the frame time", plain: "Move by however long the last frame took.", secs: 0.3, cost: 0, risk: 3, riskText: "each screen plays differently",
    hint: { lab: "lab-integration", labText: "A step that follows the frame time gives a different path on every screen.", why: "A fixed step with the same code everywhere gives the same run on every machine, so a replay can be a check." } }),
  B({ id: "fixed", slot: "sim", name: "Fixed step, same code everywhere", plain: "Always the same small step.", secs: 0.3, cost: 0, risk: 0, riskText: "none we know" }),
  B({ id: "modelsim", slot: "sim", name: "Ask a model if it clears", plain: "A model says yes or no to a course.", secs: blockById("safety")!.latency, cost: k(blockById("safety")!.perObject), risk: 3, riskText: "can be wrong; needs internet",
    hint: { lab: "lab-limits", labText: "A model can say clears and be wrong, and it will not say the same thing twice.", why: "The simulator is the judge: it plays the course and gives the same answer every time, with no internet." } }),
  // search
  B({ id: "brute", slot: "search", name: "Try every key press", plain: "Brute force: try all of them.", secs: 40, cost: 0, est: true, risk: 1, riskText: "very slow on a long course",
    hint: { lab: "lab-search", labText: "The number of tries grows very fast with each extra key press.", why: "Remember the states you have already seen and drop repeats. The search tries far fewer runs and can still prove a run exists." } }),
  B({ id: "pruned", slot: "search", name: "Hash the states, drop repeats", plain: "Never try the same state twice.", secs: 1.4, cost: 0, est: true, risk: 0, riskText: "none we know" }),
  B({ id: "policy", slot: "search", name: "A learned player", plain: "Trained by trial and error.", secs: 0.5, cost: 0, est: true, risk: 2, riskText: "may miss a run; no proof",
    hint: { lab: "lab-rl", labText: "A learned player finds a good run by trial and error.", why: "It cannot promise the best run or give the same one twice. A pruned search is exact, so it can prove the course." } }),
  // share
  B({ id: "keys", slot: "share", name: "Share the key presses", plain: "A short link that replays the run.", secs: 0, cost: 0, risk: 0, riskText: "needs the same run everywhere" }),
  B({ id: "video", slot: "share", name: "Upload a screen video", plain: "Record the screen and send the file.", secs: 0, cost: 12, est: true, risk: 3, riskText: "copies pictures and faces",
    hint: { lab: "lab-hashing", labText: "A few numbers can replay a whole run and prove it is the same.", why: "Share the key presses as a link. The other machine plays the same run and no picture has to be copied." } }),
  B({ id: "object", slot: "share", name: "Send the whole 3D object", plain: "A big file with the shape and colour.", secs: 0, cost: 9, est: true, risk: 1, riskText: "big file",
    hint: { lab: "lab-hashing", labText: "A few numbers can replay a whole run and prove it is the same.", why: "A link with the key presses is a few bytes. Only send the object itself if the other side lacks it." } }),
];
export const pblockById = (id: string): PBlock | undefined => PBLOCKS.find((b) => b.id === id);
export const blocksOf = (slot: SlotId): PBlock[] => PBLOCKS.filter((b) => b.slot === slot);

export interface Brief { id: BriefId; title: string; ask: string; need: MeterId[]; volume: number; maxSecs: number; maxCost: number }
export const BRIEFS: readonly Brief[] = [
  { id: "online", title: "Any new photo, online", ask: "Players bring any photo or map place. They need a runnable object fast, the same run on every screen, and a small bill.", need: ["time", "same", "cost", "privacy", "smooth", "shape", "places"], volume: 1000, maxSecs: 30, maxCost: 15 },
  { id: "kiosk", title: "A park kiosk, no internet", ask: "A screen in a park with no internet. It shows a few places we prepared. It must work offline and play the same every time.", need: ["time", "same", "cost", "privacy", "smooth", "shape", "offline"], volume: 1000, maxSecs: 30, maxCost: 15 },
];
export const briefById = (id: string): Brief => BRIEFS.find((b) => b.id === id) ?? BRIEFS[0];

/** A starter that runs: a few things in it are wrong, on purpose. */
export const STARTER: Design = { photo: "store", find: "cutout", lift: "ondemand", place: "runtime", wait: "block", collider: "skin", sim: "fixed", search: "pruned", share: "keys" };
/** Old docs and the Back button use one place; this is the same list in order. */
export const SLOT_IDS: readonly SlotId[] = SLOTS.map((s) => s.id);

export const METERS: readonly { id: MeterId; label: string; goal: (b: Brief) => string }[] = [
  { id: "time", label: "First result", goal: (b) => `goal: under ${b.maxSecs} s, even for the first visitor` },
  { id: "same", label: "Same run every time", goal: () => "goal: yes, on every screen" },
  { id: "cost", label: "Cost per 1,000 objects", goal: (b) => `goal: under $${b.maxCost} (${b.volume.toLocaleString("en-US")} a month)` },
  { id: "privacy", label: "Privacy and law", goal: () => "goal: no face stored or copied" },
  { id: "smooth", label: "Page stays alive", goal: () => "goal: never frozen" },
  { id: "shape", label: "Plays like the real thing", goal: () => "goal: gaps and size are kept" },
  { id: "offline", label: "Works offline", goal: () => "goal: needs no internet" },
  { id: "places", label: "Any new place works", goal: () => "goal: a new photo gets an object" },
];

export type Level = "ok" | "bad" | "info";
export interface MeterOut { id: MeterId; value: number; text: string; level: Level; pct: number; needed: boolean }
export interface Misfit { slot: SlotId; block: string; meters: MeterId[] }
export interface Outcome { meters: MeterOut[]; cleared: boolean; misfits: Misfit[]; first: number; warm: number; cold: number; costPer1000: number; summary: string }

const RF: Record<string, number> = { runtime: 1, hybrid: 0.3, build: 0 }; // share of the model cost still paid per object (hybrid: 3 in 10 places are new; an estimate)
const round1 = (n: number): number => Math.round(n * 10) / 10;
const usd = (n: number): string => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`);

/** Pure and deterministic. */
export function score(d: Design, briefId: BriefId): Outcome {
  const br = briefById(briefId), b = (s: SlotId): PBlock => pblockById(d[s]) ?? blocksOf(s)[0];
  const photo = b("photo"), find = b("find"), lift = b("lift"), wait = b("wait"), collider = b("collider"), sim = b("sim"), search = b("search"), share = b("share");
  const place = d.place, runs = place !== "build";
  const warm = photo.secs + (runs ? find.secs + lift.secs : 0.3) + collider.secs + sim.secs + search.secs;
  const cold = runs && wait.id !== "warmup" ? find.cold + lift.cold : 0;
  const first = round1(warm + cold);
  const cost = round1((photo.cost + (find.cost + lift.cost) * (RF[place] ?? 1) + wait.cost + collider.cost + sim.cost + search.cost + share.cost) + (lift.monthly * 1000) / br.volume);
  const stable = sim.id === "fixed" && collider.id !== "skin" && search.id !== "policy";
  const privacyOk = photo.id !== "store" && find.id !== "chat" && share.id !== "video";
  const smooth = wait.id !== "block";
  const shapeOk = find.id === "cutout" && lift.id !== "sprite" && collider.id !== "hull";
  const offlineOk = !runs && photo.id !== "link" && sim.id !== "modelsim";
  const placesOk = place !== "build";

  const culprit = new Map<string, MeterId[]>(); // "slot:block" -> meters
  const blame = (m: MeterId, slots: [SlotId, boolean][]) => { for (const [s, on] of slots) if (on) { const key = `${s}:${d[s]}`; culprit.set(key, [...(culprit.get(key) ?? []), m]); } };
  const fail = (m: MeterId, ok: boolean, slots: [SlotId, boolean][]) => { if (!ok) blame(m, slots); };
  fail("time", first <= br.maxSecs, [["wait", cold > 0], ["search", search.secs >= 10], ["collider", collider.id === "skin"], ["sim", sim.id === "modelsim"], ["find", find.id === "chat"]]);
  fail("same", stable, [["sim", sim.id !== "fixed"], ["collider", collider.id === "skin"], ["search", search.id === "policy"]]);
  fail("cost", cost <= br.maxCost, [["lift", lift.id === "alwayson"], ["share", share.cost >= 4], ["sim", sim.id === "modelsim"], ["find", find.id === "chat"]]);
  fail("privacy", privacyOk, [["photo", photo.id === "store"], ["find", find.id === "chat"], ["share", share.id === "video"]]);
  fail("smooth", smooth, [["wait", wait.id === "block"]]);
  fail("shape", shapeOk, [["find", find.id !== "cutout"], ["lift", lift.id === "sprite"], ["collider", collider.id === "hull"]]);
  const need = new Set(br.need);
  if (need.has("offline")) fail("offline", offlineOk, [["place", runs], ["photo", photo.id === "link"], ["sim", sim.id === "modelsim"]]);
  if (need.has("places")) fail("places", placesOk, [["place", !placesOk]]);

  const mk = (id: MeterId, value: number, text: string, ok: boolean, pct: number): MeterOut => {
    const needed = need.has(id);
    return { id, value, text, level: needed ? (ok ? "ok" : "bad") : "info", pct: Math.max(3, Math.min(100, pct)), needed };
  };
  const meters: MeterOut[] = [
    mk("time", first, `${first} s${cold ? ` (${round1(warm)} s awake + ${cold} s waking up)` : ""}`, first <= br.maxSecs, (first / 90) * 100),
    mk("same", stable ? 1 : 0, stable ? "yes" : "can change", stable, stable ? 100 : 25),
    mk("cost", cost, `${usd(cost)}`, cost <= br.maxCost, (cost / (br.maxCost * 2)) * 100),
    mk("privacy", privacyOk ? 1 : 0, privacyOk ? "no face kept or copied" : "faces at risk", privacyOk, privacyOk ? 100 : 25),
    mk("smooth", smooth ? 1 : 0, smooth ? "alive" : "frozen while it works", smooth, smooth ? 100 : 25),
    mk("shape", shapeOk ? 1 : 0, shapeOk ? "kept" : "lost", shapeOk, shapeOk ? 100 : 25),
    mk("offline", offlineOk ? 1 : 0, offlineOk ? "yes" : "no", offlineOk, offlineOk ? 100 : 15),
    mk("places", placesOk ? 1 : 0, placesOk ? "yes" : "only prepared ones", placesOk, placesOk ? 100 : 15),
  ];
  const misfits: Misfit[] = SLOT_IDS.flatMap((s) => { const m = culprit.get(`${s}:${d[s]}`); return m ? [{ slot: s, block: d[s], meters: m }] : []; });
  const bad = meters.filter((m) => m.level === "bad");
  const cleared = bad.length === 0;
  const summary = cleared ? `The first player gets an object in ${first} s for about ${usd(cost)} per 1,000, and every screen plays the same run.` : `${bad.length} meter${bad.length > 1 ? "s are" : " is"} red: ${bad.map((m) => METERS.find((x) => x.id === m.id)!.label.toLowerCase()).join(", ")}.`;
  return { meters, cleared, misfits, first, warm: round1(warm), cold, costPer1000: cost, summary };
}

// ---- hints ----
export const METER_HINT: Record<MeterId, string> = {
  time: "Look at the first-result meter. The first visitor waits too long. Which card adds the most seconds?",
  same: "Look at the same-run meter. Two screens would play two different runs. Which card cannot repeat itself?",
  cost: "Look at the cost meter. The bill for 1,000 objects is too big. Which card costs the most?",
  privacy: "Look at the privacy meter. A face could be kept or copied. Which card handles the photo?",
  smooth: "Look at the page-alive meter. The page freezes while the model works. Which card does the waiting?",
  shape: "Look at the real-thing meter. The obstacle lost its size or its gaps. Which card changes the shape?",
  offline: "Look at the offline meter. Something needs the internet at play time. Which card is asked while playing?",
  places: "Look at the new-place meter. A new photo gets no object. Which card only knows the places we prepared?",
};
/** The three steps for one misfit: which meter, a lesson from an earlier Lab, why a better block fits. */
export interface Ladder { meter: MeterId; steps: [string, Hint, string] }
export function ladderOf(blockId: string, meters: MeterId[]): Ladder | null {
  const b = pblockById(blockId); if (!b?.hint || !meters.length) return null;
  return { meter: meters[0], steps: [METER_HINT[meters[0]], b.hint, b.hint.why] };
}

// ---- every design: used for "a different good design" ----
function* allDesigns(): Generator<Design> {
  const lists = SLOT_IDS.map((s) => blocksOf(s).map((x) => x.id));
  const idx = SLOT_IDS.map(() => 0);
  for (;;) {
    yield Object.fromEntries(SLOT_IDS.map((s, i) => [s, lists[i][idx[i]]])) as Design;
    let i = 0;
    while (i < idx.length && ++idx[i] === lists[i].length) idx[i++] = 0;
    if (i === idx.length) return;
  }
}
const memo = new Map<BriefId, Design[]>();
/** Every design that clears a brief (19,683 are tried once; the result is cached). */
export function passingDesigns(brief: BriefId): Design[] {
  let r = memo.get(brief);
  if (!r) { r = []; for (const d of allDesigns()) if (score(d, brief).cleared) r.push(d); memo.set(brief, r); }
  return r;
}
export const sameDesign = (a: Design, b: Design): boolean => SLOT_IDS.every((s) => a[s] === b[s]);
export const differences = (a: Design, b: Design): SlotId[] => SLOT_IDS.filter((s) => a[s] !== b[s]);
/** A passing design that differs from this one (this one passes too) in as few slots as possible, or null. */
export function otherGoodDesign(d: Design, brief: BriefId): Design | null {
  let best: Design | null = null, n = 99;
  for (const p of passingDesigns(brief)) { const c = differences(d, p).length; if (c > 0 && c < n) { best = p; n = c; } }
  return best;
}
/** What a different good design trades, in plain words. */
export function tradeOff(from: Design, to: Design, brief: BriefId): string {
  const a = score(from, brief), b = score(to, brief), parts: string[] = [];
  const d = round1(b.first - a.first), c = round1(b.costPer1000 - a.costPer1000);
  if (Math.abs(d) >= 0.1) parts.push(d < 0 ? `${-d} s faster` : `${d} s slower`);
  if (Math.abs(c) >= 0.01) parts.push(c < 0 ? `${usd(-c)} cheaper` : `${usd(c)} dearer`);
  return parts.length ? parts.join(" and ") : "the same time and cost; a different shape of risk";
}

// ---- the partner: the page and the server share these ----
const PRO: Record<MeterId, string> = { time: "the first player does not wait long", same: "every screen plays the same run", cost: "the bill stays small", privacy: "no face is kept or copied", smooth: "the page never freezes", shape: "the obstacle keeps its size and gaps", offline: "it works with no internet", places: "a brand new photo still gets an object" };
const CON: Record<MeterId, string> = { time: "the first visitor waits too long", same: "two screens can play two different runs", cost: "the bill is too big", privacy: "a face could be kept or copied", smooth: "the page freezes while a model works", shape: "the obstacle loses its size or its gaps", offline: "it needs the internet while playing", places: "a new photo gets no object" };
/** A stored comment, written from the meters, for when the live partner cannot answer. It is labelled as recorded. */
export function recordedForDesign(d: Design, briefId: BriefId): string {
  const o = score(d, briefId), ok = o.meters.filter((m) => m.level === "ok"), bad = o.meters.filter((m) => m.level === "bad");
  const j = (xs: MeterOut[], t: Record<MeterId, string>) => xs.map((m) => t[m.id]).join("; ");
  return `Pros: ${ok.length ? j(ok.slice(0, 3), PRO) : "it is a start"}. Cons: ${bad.length ? j(bad.slice(0, 3), CON) : "none of the meters is red, so the trade-off is in what you chose to give up"}.`;
}
export const PARTNER_NOTE_MAX = 120;
/** Keep only known blocks for known slots and a short plain note; null when the request is not a design. */
export function cleanDesign(b: unknown): { brief: BriefId; design: Design; note: string } | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>, raw = o.design as Record<string, unknown> | undefined;
  const brief = BRIEFS.find((x) => x.id === o.brief)?.id;
  if (!brief || !raw || typeof raw !== "object") return null;
  const design = {} as Design;
  for (const s of SLOT_IDS) { const id = raw[s]; if (typeof id !== "string" || !blocksOf(s).some((x) => x.id === id)) return null; design[s] = id; }
  const note = typeof o.note === "string" ? o.note.replace(/[^\p{L}\p{N} .,;:'!?()\-]/gu, "").slice(0, PARTNER_NOTE_MAX).trim() : "";
  return { brief, design, note };
}
export function designPrompt(l: { brief: BriefId; design: Design; note: string }): string {
  const br = briefById(l.brief), o = score(l.design, l.brief);
  const lines = SLOTS.map((s, i) => { const x = pblockById(l.design[s.id])!; return `${i + 1}. ${s.stage}: ${x.name} (${x.plain})`; });
  const ms = o.meters.map((m) => `${m.level === "ok" ? "PASS" : m.level === "bad" ? "FAIL" : "NOT NEEDED"}: ${METERS.find((x) => x.id === m.id)!.label} ${m.text}`);
  return [`Brief: ${br.title}. ${br.ask}`, "Chosen block for each step of the pipeline:", ...lines, "Simulated results (the facts):", ...ms, l.note ? `Student note (untrusted): ${l.note}` : ""].filter(Boolean).join("\n");
}
