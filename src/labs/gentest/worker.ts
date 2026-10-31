import { testProposal, type Proposal, type Rules, type Verdict } from "./core";

// Tests each proposal through the real ideal-run search off the page's thread, and sends each verdict as soon as it is known.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; proposals: Proposal[]; rules: Rules; repairs: number; budget: number } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, proposals, rules, repairs, budget } = e.data;
  const t0 = Date.now();
  const verdicts: Verdict[] = [];
  proposals.forEach((p, i) => {
    const v = testProposal(p, rules, repairs, budget);
    verdicts.push(v);
    ctx.postMessage({ id, i: i + 1, n: proposals.length });
  });
  ctx.postMessage({ id, done: true, verdicts, wallMs: Date.now() - t0 });
};
