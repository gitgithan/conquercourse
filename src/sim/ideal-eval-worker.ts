import { makeHandler } from './ideal-eval';

// A Web Worker of the ideal-run pool (the page makes several of them).
const ctx = self as unknown as { onmessage: ((e: { data: never }) => void) | null; postMessage(m: unknown): void };
const handle = makeHandler((m) => ctx.postMessage(m));
ctx.onmessage = (e) => handle(e.data);
