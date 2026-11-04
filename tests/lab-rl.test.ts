import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseData } from "../src/course/course";
import { playPlan } from "../src/sim/ideal";
import { DEFAULT_RL, REWARD_PRESETS, Env, chunkReward, clampRl, idealReturn, randomBaseline, rng, trainNoExplore, trainRl } from "../src/lab/rl-lab";

// reinforcement learning: a game character learns the trap course by trial and error on the real simulator.
const course = JSON.parse(readFileSync("public/assets/lab/search-trap.course.json", "utf8")) as CourseData;
const honest = REWARD_PRESETS.honest.reward;
const train = (c: Partial<typeof DEFAULT_RL> = {}) => trainRl(course, { ...DEFAULT_RL, ...c }, undefined, { baselines: false });
const plain = (r: ReturnType<typeof train>): string => JSON.stringify({ ...r, q: 0, policyRun: 0 });

describe("Reinforcement learning", () => {
  it("pays points by the rules written down", () => {
    expect(chunkReward(honest, 0, 1, false, "running")).toBeCloseTo(1);
    expect(chunkReward(honest, 0, 0, false, "splash")).toBeCloseTo(-10);
    expect(chunkReward(honest, 5, 5.1, false, "cleared")).toBeCloseTo(10.1);
    expect(chunkReward({ ...honest, edge: 2, alive: 0.5 }, 0, 0, true, "running")).toBeCloseTo(2.5);
  });
  it("the seeded generator repeats and the episode is deterministic", () => {
    const a = rng(5), b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const run = () => { const e = new Env(course, honest); for (let i = 0; i < 40 && !e.done; i++) e.step(0); return [e.w.runner.x, e.w.outcome, e.ret]; };
    expect(run()).toEqual(run());
  });
  it("running into the first gap splashes; waiting goes nowhere", () => {
    const e = new Env(course, honest);
    for (let i = 0; i < 400 && !e.done; i++) e.step(0);
    expect(e.w.outcome).toBe("splash");
    const w = new Env(course, honest);
    for (let i = 0; i < 100; i++) w.step(2);
    expect(w.w.outcome).toBe("running");
    expect(w.w.runner.x).toBeLessThan(0.1);
  });
  it("gives the same numbers twice for the same choices and seed, and others for another seed", () => {
    const a = plain(train({ episodes: 300 }));
    expect(plain(train({ episodes: 300 }))).toBe(a);
    expect(plain(train({ episodes: 300, seed: 8 }))).not.toBe(a);
  });
  it("honest points: the character learns to clear, and no faster than the game's own search line", () => {
    const r = train();
    expect(r.finalCleared).toBe(true);
    expect(r.firstClearEpisode).not.toBeNull();
    expect(r.firstPolicyClearEpisode).not.toBeNull();
    expect(r.finalSeconds!).toBeGreaterThan(r.ideal.seconds! - 0.1); // a search of the same simulator is the floor
    expect(r.hacked).toBe(false);
  });
  it("the learning curve improves: late blocks collect more than early ones", () => {
    const r = train();
    const early = r.blocks.slice(0, 3).reduce((s, b) => s + b.meanReturn, 0) / 3;
    const late = r.blocks.slice(-3).reduce((s, b) => s + b.meanReturn, 0) / 3;
    expect(late).toBeGreaterThan(early);
  });
  it("random moves do not clear the course", () => {
    const b = randomBaseline(course, honest, 7, 150);
    expect(b.clearRate).toBe(0);
    expect(b.meanProgress).toBeLessThan(0.6);
  });
  it("a character that never explores does not learn to clear", () => {
    expect(trainNoExplore(course, { ...DEFAULT_RL, episodes: 400 }).clearRate).toBe(0);
  });
  it("pays for staying alive: the character farms the bonus and does not finish", () => {
    const r = train({ reward: REWARD_PRESETS.alive.reward, seed: 1 });
    expect(r.finalCleared).toBe(false);
    expect(r.hacked).toBe(true);
    expect(r.finalReturn).toBeGreaterThan(r.ideal.ret);
    expect(r.finalProgress).toBeLessThan(0.5);
  });
  it("the game's own line is paid by the same rules", () => {
    const i = idealReturn(course, honest);
    expect(i.seconds).not.toBeNull();
    expect(playPlan(course, course.plan!).world.outcome).toBe("cleared");
    expect(i.ret).toBeGreaterThan(30); // about the course length plus the finish bonus
    expect(i.ret).toBeLessThan(45);
  });
  it("keeps the choices in range", () => {
    const c = clampRl({ ...DEFAULT_RL, alpha: 9, epsilon: -1, episodes: 1, seed: -3, reward: { progress: 99, finish: -4, fall: 500, alive: -9, edge: 9 } });
    expect([c.alpha, c.epsilon, c.episodes, c.seed]).toEqual([1, 0, 50, 0]);
    expect(c.reward).toEqual({ progress: 3, finish: 0, fall: 100, alive: -1, edge: 3 });
  });
});
