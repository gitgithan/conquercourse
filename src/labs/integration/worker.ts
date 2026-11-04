import { runLab, type LabConfig } from "./engine";

// Runs a Numerical integration job off the page's thread so the page stays alive; sends the whole result when done.
const ctx = self as unknown as { onmessage: ((e: { data: { id: number; cfg: LabConfig } }) => void) | null; postMessage(m: unknown): void };
ctx.onmessage = (e) => { ctx.postMessage({ id: e.data.id, done: true, result: runLab(e.data.cfg) }); };
