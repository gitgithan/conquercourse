import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { recordPlan, verifyLog, type InputLog } from "../src/sim/replay";
import { courseTooBig, openChallenge } from "../src/share/challenge";
import { expandedAddress } from "./helpers/share-address";
import { cleanCourse, madeCourse, packCourse, unpackCourse } from "../src/share/made-course";
import { loadDemo as load } from './helpers/course';

const ORIGIN = "https://conquercourse.pages.dev";
const logOf = (course: CourseData): InputLog => {
  const { recorder } = recordPlan(course, course.plan!, 120 * 120);
  expect(recorder.valid).toBe(true);
  return recorder.snapshot();
};
const made = (c: CourseData) => ({ ...c, name: "Made in the editor" }) as CourseData; // not the default course, not named in the address

describe("a course made in the editor travels in the link (CC-136)", () => {
  it("a made course round trips: the link opens the same course and the same run", async () => {
    const course = made(load("lache.course.json")), log = logOf(course);
    const url = await expandedAddress(ORIGIN, "", course, log, "ABC");
    expect(url).not.toBeNull();
    expect(url!.length).toBeLessThan(2100);
    const q = new URL(url!).searchParams;
    const opened = (await unpackCourse(q.get("made")!))!;
    expect(opened).not.toBeNull();
    expect(verifyLog(opened, log).cleared).toBe(true);
    const c = await openChallenge(opened, q.get("challenge")!);
    expect(c.ok).toBe(true);
  });
  it("the pieces that only change the look stay out of the link", () => {
    const c = madeCourse({ ...load("lache.course.json"), scene: [{ url: "/assets/x.glb" }], uMap: {} } as unknown as CourseData)!;
    expect(c).not.toBeNull();
    expect("scene" in c).toBe(false);
    expect("plan" in c).toBe(false);
  });
  it("a changed course does not open the run", async () => {
    const course = made(load("lache.course.json")), log = logOf(course);
    const q = new URL((await expandedAddress(ORIGIN, "", course, log))!).searchParams;
    const other = (await unpackCourse(q.get("made")!))!;
    other.finishX += 1;
    expect((await openChallenge(other, q.get("challenge")!)).ok).toBe(false);
  });
  it("a course named in the address does not travel in the link", async () => {
    const course = load("lache.course.json");
    const url = (await expandedAddress(ORIGIN, "?course=/assets/demo/lache.course.json", course, logOf(course)))!;
    expect(new URL(url).searchParams.has("made")).toBe(false);
  });
  it("damaged or hostile courses are refused", async () => {
    const good = JSON.parse(JSON.stringify(load("lache.course.json")));
    expect(cleanCourse(good)).toBeNull(); // plan is a looks/derived piece and must not arrive in a link
    const base = madeCourse(good)!;
    expect(base).not.toBeNull();
    const bad = (f: (c: Record<string, unknown>) => void) => { const c = JSON.parse(JSON.stringify(base)); f(c); return cleanCourse(c); };
    expect(bad((c) => { c["bad key"] = 1; })).toBeNull();
    expect(bad((c) => { c.name = "<script>"; })).toBeNull();
    expect(bad((c) => { c.name = "https://evil.example/x"; })).toBeNull();
    expect(bad((c) => { c.version = 2; })).toBeNull();
    expect(bad((c) => { c.startX = 1e9; })).toBeNull();
    expect(bad((c) => { (c.terrain as { platforms: unknown[] }).platforms = []; })).toBeNull();
    expect(await unpackCourse("dnot-a-course")).toBeNull();
    expect(await unpackCourse("x" + "A".repeat(50))).toBeNull();
    expect(await unpackCourse("d" + "A".repeat(2000))).toBeNull();
  });
  it("a course that is too big gets no link and is named as the cause", async () => {
    const course = made(load("lache.course.json")), last = course.terrain.platforms[course.terrain.platforms.length - 1];
    for (let i = 0; i < 61; i++) course.terrain.platforms.push({ ...last, x0: last.x1 + 1 + i * 3, x1: last.x1 + 2 + i * 3 }); // more platforms than a share may hold
    expect(await courseTooBig("", course)).toBe(true);
    expect(await courseTooBig("", made(load("coaster.course.json")))).toBe(false); // the coaster that did not fit a long link fits a saved share (CC-219)
    const plain = made(load("lache.course.json"));
    expect(await courseTooBig("", plain)).toBe(false);
    expect(await packCourse(madeCourse(plain)!)).toMatch(/^d/);
  });
  it("sizes of the demo courses (printed for the issue)", async () => {
    const rows: string[] = [];
    for (const f of readdirSync("public/assets/demo").filter((x) => x.endsWith(".course.json"))) {
      const c = madeCourse(made(load(f)));
      rows.push(`${f}: ${c ? (await packCourse(c)).length : "refused"}`);
    }
    console.log(rows.join("\n"));
  });
});
