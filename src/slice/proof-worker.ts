import { answer, type ProofRequest } from './proof-answer';

// The proof worker's entry: answers the questions the editor sends (src/slice/proof-client.ts).
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; req: ProofRequest } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => {
  const { id, req } = e.data;
  try { ctx.postMessage({ id, result: answer(req) }); } catch (err) { ctx.postMessage({ id, error: String(err) }); }
};
