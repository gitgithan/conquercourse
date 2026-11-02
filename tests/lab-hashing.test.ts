import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  HASHES, avalanche, bitsDiffering, chainDigests, collisionProb, compress, expand, firstDivergence, fnv1a32, hashOf, hex, judge, logBytes, maskOfKey, playLog,
  scopeDigest, sha256, tamperLog, verdict, type Scope,
} from "../src/labs/hashing/core";
import { courseHash, recordPlan, verifyLog } from "../src/sim/replay";
import { loadDemo } from "./helpers/course";

// Lab 11 (hashing): the lab's hash code and the real replay judge. Algorithm laws first, then what each hashed part catches.
const course = loadDemo("lache.course.json");
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const orig = playLog(course, log);
const firstJump = expand(log).findIndex((m) => (m & maskOfKey("jump")) !== 0);

describe("hash functions", () => {
  it("our SHA-256 equals the platform's on short, edge and long inputs", () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 1000]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      expect(hex(sha256(b)), `length ${n}`).toBe(createHash("sha256").update(b).digest("hex"));
    }
  });
  it("FNV-1a here is the loop the game names a course with", () => {
    const text = JSON.stringify((({ plan: _p, windows: _w, shortcuts: _s, routes: _r, ...rest }) => rest)(course as unknown as Record<string, unknown>));
    expect(fnv1a32(new TextEncoder().encode(text)).toString(36)).toBe(courseHash(course));
  });
  it("a digest has the width it claims", () => { for (const h of HASHES) expect(h.digest(new Uint8Array([1, 2, 3])).length * 8).toBe(h.bits); });
});

describe("avalanche: one flipped input bit", () => {
  const bytes = logBytes(log);
  it("SHA-256 changes about half of its bits on every single-bit flip", () => {
    const a = avalanche(bytes, hashOf("sha"));
    expect(a.mean).toBeGreaterThan(0.45 * a.bits);
    expect(a.mean).toBeLessThan(0.55 * a.bits);
    expect(a.min).toBeGreaterThan(0.2 * a.bits);
  });
  it("FNV-1a mixes well enough on 32 bits; a byte sum changes only a few bits", () => {
    expect(avalanche(bytes, hashOf("fnv")).mean).toBeGreaterThan(0.3 * 32);
    expect(avalanche(bytes, hashOf("sum")).mean).toBeLessThan(0.25 * 16);
  });
});

describe("determinism makes the replay a check", () => {
  it("the same keys give the same states and the same digests, every time", () => {
    const again = playLog(course, log);
    expect(again.states).toEqual(orig.states);
    for (const s of ["log", "final", "ticks"] as Scope[]) expect(hex(scopeDigest(again, s, hashOf("sha")))).toBe(hex(scopeDigest(orig, s, hashOf("sha"))));
  });
  it("the lab's replay agrees with the game's judge", () => {
    const v = verifyLog(course, log);
    expect(orig.cleared).toBe(v.cleared);
    expect(orig.ticks).toBe(v.ticks);
    expect(orig.finalX).toBe(v.world.runner.x);
    expect(judge(course, log)).toEqual({ cleared: v.cleared, ticks: v.ticks });
    expect(orig.cleared).toBe(true);
  });
  it("run-length expand and compress are inverses", () => { expect(compress(expand(log))).toEqual(log); });
});

describe("what each hashed part catches", () => {
  const caught = (t: { tick: number; key: Parameters<typeof tamperLog>[1]["key"] }, scope: Scope, id = "sha" as const) => {
    const tam = playLog(course, tamperLog(log, t));
    return { v: verdict(orig, tam, scope, hashOf(id)), tam };
  };
  it("removing the first jump is caught by all three parts", () => {
    for (const s of ["log", "final", "ticks"] as Scope[]) expect(caught({ tick: firstJump, key: "jump" }, s).v.caught, s).toBe(true);
  });
  it("a key that does nothing here is seen in the log but not in the states", () => {
    const t = { tick: 3, key: "aimUp" as const };
    const { v: vl, tam } = caught(t, "log");
    expect(vl.caught).toBe(true);
    expect(firstDivergence(orig, tam)).toBeNull();
    expect(caught(t, "final").v.caught).toBe(false);
    expect(caught(t, "ticks").v.caught).toBe(false);
  });
  it("dropping a tick changes the log, and the divergence tick is where the hash chain first differs", () => {
    const t = { tick: firstJump, key: "drop" as const };
    const tam = playLog(course, tamperLog(log, t));
    const d = firstDivergence(orig, tam);
    expect(d).not.toBeNull();
    const a = chainDigests(orig.states, hashOf("sha")), b = chainDigests(tam.states, hashOf("sha"));
    const firstDiff = a.findIndex((x, i) => b[i] === undefined || hex(x) !== hex(b[i]));
    expect(firstDiff).toBe(d);
    expect(verdict(orig, tam, "log", hashOf("sha")).caught).toBe(true);
  });
  it("a strong hash moves about half its bits for a tamper; the same tamper moves few bits of a byte sum", () => {
    const tam = playLog(course, tamperLog(log, { tick: firstJump, key: "jump" }));
    const s = verdict(orig, tam, "log", hashOf("sha"));
    expect(s.bitsChanged).toBeGreaterThan(16);
    expect(s.bitsChanged).toBeLessThan(48);
    expect(bitsDiffering(hashOf("sum").digest(new Uint8Array([1, 2])), hashOf("sum").digest(new Uint8Array([2, 1])))).toBe(0); // the sum cannot tell an order swap
  });
  it("an out-of-range tick leaves the log alone", () => { expect(tamperLog(log, { tick: 1e9, key: "jump" })).toEqual(log); });
});

describe("the maths", () => {
  it("birthday bound: 32 bits and 100000 inputs is likely a collision; 64 bits is not", () => {
    expect(collisionProb(32, 1e5)).toBeGreaterThan(0.6);
    expect(collisionProb(32, 1e5)).toBeLessThan(0.75);
    expect(collisionProb(64, 1e5)).toBeLessThan(1e-9);
    expect(collisionProb(16, 1)).toBe(0);
  });
});
