import type { CourseData } from "../course/course";
import { pathOfPlan, policyStrip, trainNoExplore, trainRl, type Block, type RlConfig } from "./rl-lab";

// Runs a Reinforcement learning training off the page's thread. Sends the curve block by block, then the result with the learned run's path.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; course: CourseData; cfg: RlConfig } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, course, cfg } = e.data;
  const t0 = Date.now();
  const r = trainRl(course, cfg, (b: Block, done: number) => ctx.postMessage({ id, block: b, done }));
  r.greedy = trainNoExplore(course, cfg);
  const { q, policyRun, ...result } = r;
  ctx.postMessage({ id, done: true, result, found: policyRun.path, ours: pathOfPlan(course), strip: policyStrip(q), wallMs: Date.now() - t0 });
};
