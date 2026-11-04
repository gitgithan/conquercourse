// Lab 18 (System design): the blocks a player can drag. Every number below comes from a doc or a recorded run; the `source` says which.
// Numbers that are arithmetic on a recorded price are marked "derived". Where nothing was recorded the field is 0 and `note` says "not recorded".
export type Where = "browser" | "edge" | "gpu" | "api" | "cpu";
export type Job = "blur" | "cutout" | "lift" | "safety" | "motion" | "style" | "collider" | "prove";
export type FailKind = "none" | "gpu" | "safety" | "door" | "db" | "host";
export type Group = "page" | "models" | "guards" | "net";

export interface Block {
  id: string;
  name: string;
  /** One plain line for the palette. */
  short: string;
  group: Group;
  where: Where;
  /** What stage this block does (a model block does one job). */
  job?: Job;
  /** Dollars for one object (derived from recorded GPU seconds or a recorded estimate). */
  perObject: number;
  /** Dollars a month whatever the traffic (a machine kept on). */
  monthly: number;
  /** True when the price is not in our docs. */
  unmeasured?: boolean;
  /** Typical seconds this block adds to the first result when warm. */
  latency: number;
  /** Extra seconds the first visitor waits when nothing was warmed up. */
  cold: number;
  /** Sees the photo and is a model we run on a GPU or host. */
  seesPhoto?: boolean;
  /** Paid per use (GPU seconds or tokens). */
  paid?: boolean;
  /** Meta API contributor model: Meta may train on what it is sent. */
  contributor?: boolean;
  fail: FailKind;
  facts: string[];
  source: string;
  note?: string;
}

const HOUR = 730; // hours in a month, used only for "kept on all month"
export const L4_PER_HOUR = 0.8, L40S_PER_HOUR = 1.95; // docs/model-limits.md section D (data/eval/demo-lifts/run.json)
export const FINDER_SECONDS = [1.1, 4.2], LIFT_SECONDS = [8, 15]; // same source
const mid = (r: number[]): number => (r[0] + r[1]) / 2;
const finderCost = (mid(FINDER_SECONDS) * L4_PER_HOUR) / 3600; // derived: about $0.0006
const liftCost = (mid(LIFT_SECONDS) * L40S_PER_HOUR) / 3600; // derived: about $0.0062

export const BLOCKS: readonly Block[] = [
  { id: "browser", name: "Browser game (WebGL)", short: "The page the player sees; the simulator runs here.", group: "page", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["WebGPU where available, WebGL 2 otherwise.", "Saved objects stay in this browser (IndexedDB).", "The simulator that judges a course runs here, so a judge costs us nothing."], source: "docs/deploy.md, docs/pipelines.md section 12" },
  { id: "pages", name: "Cloudflare Pages", short: "Hosts the page. Free tier, always on.", group: "page", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "host",
    facts: ["Free tier, always on, a fixed address.", "Cost: $0 on the free tier."], source: "docs/deploy.md" },
  { id: "functions", name: "Pages Functions (the server door)", short: "A small server that holds every key. The page never does.", group: "page", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "door",
    facts: ["Keys live only in server secrets.", "Checks the size and shape of a request before anything costs money."], source: "docs/lessons.md (keys stay out of the browser), docs/pipelines.md section 12" },
  { id: "d1", name: "D1 database", short: "Keeps share links, on/off switches and usage counts.", group: "page", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "db",
    facts: ["No names, emails or addresses are stored.", "Shared pieces and challenge courses are stored here."], source: "docs/deploy.md" },
  { id: "keyinpage", name: "Call the model from the page", short: "No server to write. The key ships inside the page.", group: "page", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["Anyone who opens the page can copy the key and spend your credit."], source: "docs/lessons.md (keys stay out of the browser and out of the repo)" },
  { id: "limits", name: "Rate limit and daily slots", short: "A cap on jobs per visitor and per day, before money is spent.", group: "guards", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["6 jobs in 10 minutes for one address.", "3 a day per player and 100 a day for the whole game."], source: "docs/pipelines.md section 12 (gates, in order)" },
  { id: "mask", name: "Privacy mask (blur faces and plates)", short: "Blurs people before a cut-out or lift model sees the photo.", group: "guards", where: "gpu", job: "blur", perObject: 0, monthly: 0, latency: 0, cold: 0, seesPhoto: true, fail: "gpu",
    facts: ["Runs inside the same GPU job as the cut-out, so no extra price is recorded.", "Lesson: mask faces and bystanders before any model sees a frame."], source: "docs/lessons.md (Privacy and footage), docs/pipelines.md section 12", note: "separate time not recorded" },
  { id: "safety", name: "Muse Spark Open safety check", short: "An AI looks at a small copy and says ok, review or block.", group: "models", where: "api", job: "safety", perObject: 0.003, monthly: 0, latency: 7, cold: 0, paid: true, fail: "safety",
    facts: ["Median 7 s, slowest seen 88.9 s.", "Missed 1 unsafe test in 38. Fails closed: if it cannot run, the job stops.", "About 0.3 cents a check (rough estimate)."], source: "docs/model-limits.md (safety rows), functions/_lib/usage.ts" },
  { id: "safety-meta", name: "Meta API contributor model as the safety check", short: "Cheaper. Meta may train on what you send it.", group: "models", where: "api", job: "safety", perObject: 0, monthly: 0, latency: 7, cold: 0, paid: true, contributor: true, fail: "safety",
    facts: ["Contributor models are cheaper, but Meta may train on the inputs.", "Never send private data to them."], source: "docs/lessons.md (Models and services)", note: "price not recorded" },
  { id: "secondhost", name: "Second host for the safety model (Fireworks)", short: "Same model, same token price, another company.", group: "net", where: "api", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["Baseten, Fireworks and Modal sell the model at the same token price.", "Our code does not call Fireworks yet: this is a plan, not a built part."], source: "docs/model-ledger.md section 3" },
  { id: "sam3", name: "SAM 3 cut-out (Modal L4)", short: "Meta's model that finds and cuts out the object.", group: "models", where: "gpu", job: "cutout", perObject: finderCost, monthly: 0, latency: mid(FINDER_SECONDS), cold: 14, seesPhoto: true, paid: true, fail: "gpu",
    facts: ["1.1 to 4.2 s a run on an L4 at about $0.80 an hour (derived: about $0.0006).", "A cold start adds about 14 s."], source: "docs/model-limits.md section D, data/eval/demo-lifts/run.json" },
  { id: "sam3d", name: "SAM 3D Objects lift (Modal L40S)", short: "Meta's model that turns the cut-out into a 3D skin.", group: "models", where: "gpu", job: "lift", perObject: liftCost, monthly: 0, latency: mid(LIFT_SECONDS), cold: 46, seesPhoto: true, paid: true, fail: "gpu",
    facts: ["8 to 15 s a lift on an L40S at about $1.95 an hour (derived: about $0.006).", "A cold start adds about 46 s."], source: "docs/model-limits.md section D, data/eval/demo-lifts/run.json" },
  { id: "alwayson", name: "L40S lift kept on all month", short: "A GPU that never sleeps. No cold start.", group: "models", where: "gpu", job: "lift", perObject: 0, monthly: Math.round(L40S_PER_HOUR * HOUR * 100) / 100, latency: mid(LIFT_SECONDS), cold: 0, seesPhoto: true, paid: true, fail: "gpu",
    facts: ["You pay every hour, used or not: $1.95 x 730 hours (derived)."], source: "docs/model-limits.md section D (hourly price), docs/pipelines.md section 12 (Modal asks for the GPU only when a job starts)" },
  { id: "vultr", name: "Vultr VM serving the lift", short: "Our own machine, always on. Used for experiments today.", group: "models", where: "gpu", job: "lift", perObject: 0, monthly: 0, unmeasured: true, latency: mid(LIFT_SECONDS), cold: 0, seesPhoto: true, paid: true, fail: "gpu",
    facts: ["Good for batch experiments and browser tests, paid by credit.", "A price comparison with Modal was never measured."], source: "docs/model-ledger.md section 3" },
  { id: "bake", name: "Bake a texture (CPU)", short: "Puts the colour into a 1024 picture on the skin.", group: "models", where: "cpu", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["Vertex colours smeared a painted wall; a baked 1024 texture fixed it."], source: "docs/lessons.md (Photos to 3D objects)", note: "time not recorded" },
  { id: "fitcollider", name: "Fit a simple collider (bars row)", short: "Turns the noisy skin into a few clean numbers for physics.", group: "guards", where: "browser", job: "collider", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["A photo becomes a skin, never a collider."], source: "docs/lessons.md (Photos to 3D objects), docs/labs/collision.md" },
  { id: "meshcollider", name: "Use the lifted mesh as the collider", short: "Fewer steps. The physics touches every noisy triangle.", group: "guards", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["A lift is noisy: a missed rung or a fused pair changes what the runner can grab."], source: "docs/lessons.md (Photos to 3D objects), docs/labs/collision.md" },
  { id: "sim", name: "Simulator as judge", short: "The game's physics decides if a course can be cleared.", group: "guards", where: "browser", job: "prove", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["The simulator is truth: a model suggests, the simulator proves.", "Of 100 asked layouts, 95 were readable and 33 cleared."], source: "docs/model-limits.md (designer row), docs/lessons.md" },
  { id: "modeljudge", name: "Ask the AI if the course clears", short: "One call and an answer. No simulator run needed.", group: "guards", where: "api", perObject: 0, monthly: 0, latency: 14.8, cold: 0, fail: "none",
    facts: ["The designer call took a median 14.8 s.", "Only 33 of 100 asked layouts cleared in the simulator."], source: "docs/model-limits.md (designer row)" },
  { id: "gate", name: "Plausibility gate (motion)", short: "Holds back a move that breaks the body or the physics.", group: "guards", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["No motion is shown before it passes the check."], source: "CLAUDE.md hard rules, docs/labs/motion.md" },
  { id: "kimodo", name: "Kimodo motion (Modal L4)", short: "Makes a body move from words. NVIDIA's model, not Meta's.", group: "models", where: "gpu", job: "motion", perObject: 0, monthly: 0, latency: 0, cold: 0, paid: true, fail: "gpu",
    facts: ["It has a Llama 3 8B text encoder.", "It has no hangs in its training labels: hands stay near 1.1 m on 2.2 m rungs."], source: "docs/model-limits.md (Kimodo row)", note: "time and price not recorded" },
  { id: "museimage", name: "Muse Image", short: "Draws a picture in a given style. Used for characters.", group: "models", where: "api", job: "style", perObject: 0.0125, monthly: 0, latency: 0, cold: 0, paid: true, fail: "gpu",
    facts: ["About $0.0125 of Meta credit per character, with one SAM call."], source: "docs/model-ledger.md, docs/community-characters.md", note: "time not recorded" },
  { id: "warm", name: "Warm-up call", short: "Wakes the GPU while the player is still picking the photo.", group: "net", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["The Community page calls it when the Make tab opens.", "The extra idle cost per visit is not measured yet."], source: "docs/pipelines.md section 12 (Pitfalls)" },
  { id: "queue", name: "Job and status polling", short: "Start a job, then ask 'done yet?' every few seconds.", group: "net", where: "edge", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["The page asks every few seconds and gives up after about 20 minutes with a plain message."], source: "docs/pipelines.md section 12" },
  { id: "keep", name: "Keep the result in the browser", short: "The object is saved on the player's device.", group: "net", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["Saved in IndexedDB with its credit record.", "The photo itself is never stored."], source: "docs/pipelines.md section 12 (provenance)" },
  { id: "library", name: "Ready-made library", short: "Objects and clips we already made and shipped.", group: "net", where: "browser", perObject: 0, monthly: 0, latency: 0, cold: 0, fail: "none",
    facts: ["19 shipped objects with their credits, plus shipped motion clips.", "Works with every server and GPU switched off."], source: "docs/pipelines.md section 12, docs/ASSETS.md" },
];

export const BLOCK_IDS: readonly string[] = BLOCKS.map((b) => b.id);
export const blockById = (id: string): Block | undefined => BLOCKS.find((b) => b.id === id);
export const GROUP_TITLES: Record<Group, string> = { page: "Page and server", models: "Models and GPUs", guards: "Guards and judges", net: "Safety net" };
export const WHERE_TITLES: Record<Where, string> = { browser: "in the browser", edge: "on the edge server", gpu: "on a rented GPU", api: "a model host", cpu: "on a CPU" };
