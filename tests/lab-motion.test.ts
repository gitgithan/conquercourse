import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { parseClip } from "../src/motion/clip";
import { legLength } from "../src/motion/timeline";
import { MOTION_TABLE } from "../src/motion/motion-table";
import { TICKS_PER_SECOND } from "../src/sim/units";
import type { SignalClip } from "../src/lab/signal-lab";
import {
  LAB_CLIPS, SINK_M, JUMP_M, applyGameSmoothing, buildClip, checkShape, clipFrameAtTick, clipSeconds, clockOffPercent, dropLastName, dropLastNameOnly,
  frameTime, liftToFloor, onlyBoneLengths, poseAtTick, retargetScale, tickSeconds, ticksFor, verdict, whyFailed, withFps,
} from "../src/labs/motion/motion-core";

// Lab 13 (Video to motion): the gate verdicts on recorded good clips, recorded bad clips and clips we broke on purpose.
const files: Record<string, SignalClip> = {};
for (const u of new Set(LAB_CLIPS.map((c) => c.url))) files[u] = JSON.parse(readFileSync("public" + u, "utf8"));
const clipById = (id: string) => LAB_CLIPS.find((c) => c.id === id)!;
const get = (id: string) => buildClip(clipById(id), files);
const v = (id: string) => verdict(clipById(id), get(id));
const rec = JSON.parse(readFileSync("public/assets/lab/motion-recorded.json", "utf8"));
const py = JSON.parse(readFileSync("data/eval/motion-from-you/roll-lp/gate.json", "utf8"));

describe("the gate verdicts, pinned", () => {
  it("every recorded good clip passes the hard rules", () => {
    for (const s of LAB_CLIPS.filter((c) => c.origin === "recorded-pass")) expect(v(s.id).pass, s.id).toBe(true);
  });
  it("the whole film of the roll fails because it does not fall like a body in the air", () => {
    const x = v("roll-whole");
    expect(x.pass).toBe(false);
    expect(x.failed).toEqual(["flight_is_ballistic"]);
    expect(x.report.hard.flight_is_ballistic.value!).toBeLessThan(0);
    expect(whyFailed(x)).toContain("9.81");
  });
  it("the generated wall clip fails because nothing holds the body for over a second", () => {
    const x = v("wall-a");
    expect(x.failed).toEqual(["held_clips_are_held"]);
    expect(x.report.hard.held_clips_are_held.value!).toBeGreaterThan(1);
  });
  it("the TypeScript gate gives the Python gate's number for the filmed roll (flight, within 0.05 m/s2)", () => {
    expect(rec.verdict).toBe("FAIL");
    expect(Math.abs(v("roll-whole").report.hard.flight_is_ballistic.value! - py.repaired.hard.flight_is_ballistic.value)).toBeLessThan(0.05);
    expect(rec.raw.hard.feet_dont_sink.ok).toBe(false);
    expect(rec.repaired.hard.feet_dont_sink.ok).toBe(true);
  });
  it("each clip we broke fails the one rule it was broken for, and the unbroken source passes", () => {
    expect(v("run").pass).toBe(true);
    expect(v("sink").failed).toEqual(["feet_dont_sink"]);
    expect(v("sink").report.hard.feet_dont_sink.value!).toBeCloseTo(SINK_M, 2);
    expect(v("teleport").failed).toEqual(["no_teleport"]);
    expect(v("teleport").report.hard.no_teleport.value!).toBeGreaterThan(12);
    expect(v("slow").failed).toEqual(["flight_is_ballistic"]);
    expect(v("slow").report.hard.flight_is_ballistic.value!).toBeCloseTo(9.81 / 4, 0); // half the speed is a quarter of the gravity
  });
  it("a stretching arm breaks only the soft rule: it is reported, and the clip is not blocked", () => {
    const x = v("bones");
    expect(x.pass).toBe(true);
    expect(x.softFailed).toContain("bones_keep_length");
    expect(v("vault").softFailed).not.toContain("bones_keep_length");
  });
  it("the made-broken clips are changes of shipped clips only (same names, same frame count)", () => {
    for (const s of LAB_CLIPS.filter((c) => c.breakWith)) {
      const a = files[s.url], b = get(s.id);
      expect(b.names).toEqual(a.names);
      expect(b.frames.length).toBe(a.frames.length);
    }
  });
});

describe("repairs and smoothing", () => {
  it("lifting to the floor undoes the sunk feet and the clip then passes", () => {
    const sunk = get("sink"), fixed = { ...sunk, frames: liftToFloor(sunk.frames).frames };
    expect(verdict(clipById("sink"), fixed).pass).toBe(true);
    expect(liftToFloor(sunk.frames).changed).toBeGreaterThan(0);
    expect(liftToFloor(files["/assets/motion/run.json"].frames).changed).toBe(0);
  });
  it("no allowed repair makes a jump in place or a wrong clock pass (those clips stay held back)", () => {
    const t = get("teleport"), fixedT = { ...t, frames: liftToFloor(t.frames).frames };
    expect(verdict(clipById("teleport"), fixedT).failed).toEqual(["no_teleport"]);
    const s = get("slow"), fixedS = { ...s, frames: liftToFloor(s.frames).frames };
    expect(verdict(clipById("slow"), fixedS).failed).toEqual(["flight_is_ballistic"]);
  });
  it("one length per bone brings the stretching arm back under the 2% limit", () => {
    const b = get("bones");
    expect(verdict(clipById("bones"), onlyBoneLengths(b)).softFailed).not.toContain("bones_keep_length");
    expect(verdict(clipById("bones"), applyGameSmoothing(b)).softFailed).not.toContain("bones_keep_length");
  });
  it("the game's smoothing keeps a passing clip passing", () => {
    for (const id of ["run", "leap", "vault", "roll-crouch"]) expect(verdict(clipById(id), applyGameSmoothing(get(id))).pass, id).toBe(true);
  });
});

describe("names and positions line up", () => {
  it("every clip file in the Lab is accepted by the game's reader, with one position per name", () => {
    for (const u of Object.keys(files)) { const c = parseClip(structuredClone(files[u])); expect(c.frames.every((f) => f.length === c.names.length), u).toBe(true); }
  });
  it("a clip with one name lost is refused, with a message that counts both", () => {
    const c = files["/assets/motion/vault.json"];
    expect(checkShape(c).ok).toBe(true);
    const bad = checkShape(dropLastName(c));
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/frame 0 has 30 joints, names has 29/);
    expect(checkShape(dropLastNameOnly(c)).message).toMatch(/names \(29\) and parents \(30\)/);
  });
});

describe("one clock", () => {
  it("frame i is at i over the source rate, and the filmed clips keep their 29.97", () => {
    const vault = files["/assets/motion/vault.json"];
    expect(frameTime(30, 30)).toBe(1);
    expect(vault.fps).toBeCloseTo(29.97, 2);
    expect(clipSeconds(vault)).toBeCloseTo((vault.frames.length - 1) / 29.97, 3);
  });
  it("30 typed for 29.97 is 0.1% off and harmless; 24 typed for 30 is 25% off and the gate refuses a good leap", () => {
    expect(Math.abs(clockOffPercent(29.97, 30))).toBeLessThan(0.11);
    expect(clockOffPercent(30, 24)).toBeCloseTo(25, 5);
    const leap = files["/assets/motion/leap.json"];
    expect(verdict(clipById("leap"), withFps(leap, 30)).pass).toBe(true);
    expect(verdict(clipById("leap"), withFps(leap, 24)).failed).toContain("flight_is_ballistic");
  });
  it("the pose shown is a function of the tick only: tick / 120 seconds into the clip", () => {
    expect(TICKS_PER_SECOND).toBe(120);
    expect(tickSeconds(60)).toBe(0.5);
    expect(clipFrameAtTick(120, 30)).toBe(30);
    const c = parseClip(structuredClone(files["/assets/motion/run.json"]));
    expect(poseAtTick(c, 4)[0]).toEqual(poseAtTick(c, 4)[0]);
    expect(poseAtTick(c, 4)[0][2]).toBeCloseTo(c.frames[1][0][2], 6); // tick 4 = 1/30 s = frame 1
    expect(ticksFor(c)).toBe(Math.ceil(((c.frames.length - 1) / c.fps) * 120));
  });
});

describe("retarget and the move table", () => {
  it("the scale makes the clip's leg exactly the character's leg and keeps every proportion", () => {
    const c = files["/assets/motion/run.json"], p = (i: number) => new Vector3(...c.frames[0][i]);
    const leg = legLength(c.names, p), s = retargetScale(0.9, leg);
    expect(leg * s).toBeCloseTo(0.9, 9);
    const a = p(0).distanceTo(p(c.names.indexOf("Head"))), b = p(0).multiplyScalar(s).distanceTo(p(c.names.indexOf("Head")).multiplyScalar(s));
    expect(b / a).toBeCloseTo(s, 9);
  });
  it("every clip the move table names exists as a file, and the clips that ship all pass the gate", () => {
    for (const e of Object.values(MOTION_TABLE)) if (e.clip) {
      const c = JSON.parse(readFileSync(`public/assets/motion/${e.clip}.json`, "utf8")) as SignalClip;
      expect(verdict(clipById("run"), c).pass, e.clip).toBe(true);
    }
  });
});

describe("registration", () => {
  it("the Lab is in the nav, the loaders, the picker and has a doc with the four sections", () => {
    expect(readFileSync("src/ui/labs-nav.ts", "utf8")).toContain("lab-motion");
    expect(readFileSync("src/main-loaders.ts", "utf8")).toContain("lab-motion");
    expect(readFileSync("src/ui/world-picker.ts", "utf8")).toContain("Lab 13: Video to motion");
    const doc = readFileSync("docs/labs/motion.md", "utf8");
    for (const h of ["How it was designed", "How we prove the lesson is right", "Limits", "How to make the lesson better"]) expect(doc).toContain(`## ${h}`);
  });
  it("the made-broken constants are the ones the page says", () => { expect(SINK_M).toBe(0.08); expect(JUMP_M).toBe(1.5); });
});
