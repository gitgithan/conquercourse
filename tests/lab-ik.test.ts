import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import { parseClip } from "../src/motion/clip";
import { ik2 } from "../src/motion/compose";
import { legLength } from "../src/motion/timeline";
import { DEFAULT_CHOICES, ELBOW_MAX, MATCH, basePose, breakingPoint, forward, makeBody, maxReach, minReach, neckFacts, poseFor, solveArm, solveDls, solveTwoBone, type Body, type Choices } from "../src/labs/ik/ik-core";

// Lab 3 (posing a character): the arm bend, the elbow flip, the reach limit. The two-bone solver and the neck rule are the game's own functions.
const clip = (n: string) => parseClip(JSON.parse(readFileSync(`public/assets/motion/${n}.json`, "utf8")));
// The Rookie's bones from the model file's node tree (no textures needed), world positions in clip order.
async function body(): Promise<Body> {
  const buf = readFileSync("public/assets/characters/rookie-a.glb");
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as { nodes: { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[]; scenes: { nodes: number[] }[] };
  const objs = gltf.nodes.map((n) => {
    const o = new Object3D(); o.name = n.name ?? "";
    if (n.translation) o.position.set(...(n.translation as [number, number, number]));
    if (n.rotation) o.quaternion.set(...(n.rotation as [number, number, number, number]));
    if (n.scale) o.scale.set(...(n.scale as [number, number, number]));
    return o;
  });
  gltf.nodes.forEach((n, i) => n.children?.forEach((c) => objs[i].add(objs[c])));
  const scene = new Object3D();
  gltf.scenes[0].nodes.forEach((i) => scene.add(objs[i]));
  scene.updateMatrixWorld(true);
  const run = clip("run"), land = clip("land");
  const rest = run.names.map((n) => scene.getObjectByName(n)!.getWorldPosition(new Vector3()));
  return makeBody(run, land, rest, legLength(run.names, (i) => rest[i]));
}
const C = (o: Partial<Choices> = {}): Choices => ({ ...DEFAULT_CHOICES, ...o });

describe("Lab 3: inverse kinematics", () => {
  it("builds a Rookie that stands on the floor with sensible arm and leg sizes", async () => {
    const b = await body();
    expect(Math.min(...b.stand.map((p) => p.y))).toBeCloseTo(0, 6);
    const l1 = b.stand[b.ix("LeftArm")].distanceTo(b.stand[b.ix("LeftForeArm")]), l2 = b.stand[b.ix("LeftForeArm")].distanceTo(b.stand[b.ix("LeftHand")]);
    expect(l1 + l2).toBeGreaterThan(0.45);
    expect(l1 + l2).toBeLessThan(0.9);
  });
  it("the two-bone solver is the game's ik2 (same elbow, same hand)", async () => {
    const b = await body();
    const p = poseFor(b, C({ fold: 0 }), 0.5, 1.3);
    const sh = new Vector3(p.shoulder.x, p.shoulder.y, 0);
    const r = ik2(sh, new Vector3(0.5, 1.3, 0), p.l1, p.l2, new Vector3(-0.6, -1, 0));
    expect(p.arm.elbow.x).toBeCloseTo(r.elbow.x, 6);
    expect(p.arm.elbow.y).toBeCloseTo(r.elbow.y, 6);
    expect(p.arm.hand.x).toBeCloseTo(r.hand.x, 6);
  });
  it("law of cosines: a reachable target is hit exactly and the bones keep their length", async () => {
    const b = await body();
    const p = poseFor(b, C({ fold: 0 }), 0.35, 1.35);
    expect(p.arm.residual).toBeLessThan(1e-6);
    expect(Math.hypot(p.arm.elbow.x - p.shoulder.x, p.arm.elbow.y - p.shoulder.y)).toBeCloseTo(p.l1, 6);
    expect(Math.hypot(p.arm.hand.x - p.arm.elbow.x, p.arm.hand.y - p.arm.elbow.y)).toBeCloseTo(p.l2, 6);
    const cosInterior = (p.l1 ** 2 + p.l2 ** 2 - Math.hypot(0.35 - p.shoulder.x, 1.35 - p.shoulder.y) ** 2) / (2 * p.l1 * p.l2);
    expect(Math.PI - Math.acos(cosInterior)).toBeCloseTo(Math.abs(p.arm.bend), 5);
  });
  it("past full stretch the hand stops at the reach, short by the extra distance", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const R = maxReach(base.l1, base.l2), sh = base.shoulder;
    const p = poseFor(b, C({ fold: 0 }), sh.x + R + 0.2, sh.y);
    expect(p.arm.residual).toBeCloseTo(0.2, 3);
    const found = breakingPoint(C({ fold: 0 }), sh, base.l1, base.l2, sh.x + 1, sh.y)!;
    expect(found.distance).toBeCloseTo(R, 2);
  });
  it("too close to the shoulder also breaks (a folded arm cannot be shorter than |l1 - l2|)", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const lo = minReach(base.l1, base.l2);
    expect(lo).toBeGreaterThanOrEqual(0);
    const p = solveTwoBone(base.shoulder, base.l1, base.l2, base.shoulder.x, base.shoulder.y, false);
    expect(p.residual).toBeLessThan(lo + 0.001);
  });
  it("the elbow flips when the target crosses the line the elbow is pushed along", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const sh = base.shoulder;
    const front = solveTwoBone(sh, base.l1, base.l2, sh.x + 0.35, sh.y + 0.1, false);
    const behind = solveTwoBone(sh, base.l1, base.l2, sh.x - 0.35, sh.y + 0.1, false);
    expect(front.flipped).toBe(false);
    expect(behind.flipped).toBe(true);
    expect(front.bend).toBeGreaterThan(0);
  });
  it("limits on: an elbow never bends backwards or past its range, so a behind-the-back target is missed", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const sh = base.shoulder;
    const free = solveTwoBone(sh, base.l1, base.l2, sh.x - 0.35, sh.y + 0.1, false);
    const held = solveTwoBone(sh, base.l1, base.l2, sh.x - 0.35, sh.y + 0.1, true);
    expect(free.residual).toBeLessThan(1e-6);
    expect(held.flipped).toBe(false);
    expect(held.bend).toBeGreaterThanOrEqual(0);
    expect(held.bend).toBeLessThanOrEqual(ELBOW_MAX + 1e-9);
    expect(held.residual).toBeGreaterThan(0.01);
  });
  it("damped least squares reaches what the two-bone solver reaches, in several steps, and lands on the same hand", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const sh = base.shoulder;
    for (const [dx, dy] of [[0.3, 0.2], [0.2, 0.3], [0.1, -0.2], [0.35, 0]]) {
      const a = solveDls(sh, base.l1, base.l2, sh.x + dx, sh.y + dy, false, 0.1);
      expect(a.residual).toBeLessThan(MATCH);
      expect(a.iterations).toBeGreaterThan(1);
      const t = solveTwoBone(sh, base.l1, base.l2, sh.x + dx, sh.y + dy, false);
      expect(Math.hypot(a.hand.x - t.hand.x, a.hand.y - t.hand.y)).toBeLessThan(MATCH * 2);
    }
  });
  it("a bigger damping makes it slower to arrive; none of it moves the answer when the target is out of reach", async () => {
    const b = await body();
    const base = poseFor(b, C({ fold: 0 }), 0, 0);
    const sh = base.shoulder;
    const small = solveDls(sh, base.l1, base.l2, sh.x + 0.3, sh.y + 0.2, false, 0.05);
    const big = solveDls(sh, base.l1, base.l2, sh.x + 0.3, sh.y + 0.2, false, 0.6);
    expect(big.iterations).toBeGreaterThan(small.iterations);
    const far = solveDls(sh, base.l1, base.l2, sh.x + 2, sh.y, false, 0.1);
    expect(far.residual).toBeCloseTo(2 - maxReach(base.l1, base.l2), 2);
  });
  it("is the same answer twice for the same choices", async () => {
    const b = await body();
    for (const solver of ["two-bone", "dls"] as const) {
      const a = JSON.stringify(poseFor(b, C({ solver }), 0.4, 1.2).arm), c = JSON.stringify(poseFor(b, C({ solver }), 0.4, 1.2).arm);
      expect(a).toBe(c);
    }
  });
  it("the neck rule keeps the head within the game's limit in a crouch; without it the head goes further", async () => {
    const b = await body();
    const on = neckFacts(b, basePose(b, 1, true)), off = neckFacts(b, basePose(b, 1, false));
    expect(on.headDeg).toBeLessThanOrEqual(on.limitDeg + 0.01);
    expect(on.shoulderCm).toBeLessThanOrEqual(on.shoulderLimitCm + 0.01);
    expect(off.headDeg).toBeGreaterThan(on.limitDeg + 1);
    expect(neckFacts(b, basePose(b, 0, false)).headDeg).toBeLessThan(0.01);
  });
  it("forward kinematics: arm straight down is 0, forward is positive", () => {
    const down = forward({ x: 0, y: 1 }, 0.3, 0.3, 0, 0);
    expect(down.hand.y).toBeCloseTo(0.4, 9);
    const fwd = forward({ x: 0, y: 1 }, 0.3, 0.3, Math.PI / 2, 0);
    expect(fwd.hand.x).toBeCloseTo(0.6, 9);
    expect(solveArm(DEFAULT_CHOICES, { x: 0, y: 1 }, 0.3, 0.3, 0.3, 1.2).residual).toBeLessThan(1e-6);
  });
});
