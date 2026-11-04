import { testLayout } from "../../slice/course-agent-tools";
import type { Layout } from "../../slice/layout-draft";

// Runs the game's own proof (the Course Agent's tool: ideal-run search, then the proved single easings) off the page's thread.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; layout: Layout } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const t0 = Date.now();
  ctx.postMessage({ id: e.data.id, report: testLayout(e.data.layout, { probeSeconds: 8 }), ms: Date.now() - t0 });
};
