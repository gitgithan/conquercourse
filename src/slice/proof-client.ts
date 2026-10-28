import type { CourseData } from '../course/course';
import { workSeconds } from '../sim/ideal';
import type { Advice, LaneSetting } from './advice';
import type { FixedBars } from './fixbars';
import type { Fixed } from './fixit';
import type { P } from './holds-world';
import { answer, type ProofRequest } from './proof-answer';

// The page side of the proof worker. One worker per kind of question, so a new "does this lane clear?" while the player drags can cancel the old one
// (the worker is stopped and a fresh one made) without stopping a Fix it that is still working. Where there are no workers (a test, an old browser) the
// question is answered on the page's thread with the same code.
const workers = new Map<string, Worker>();
const pending = new Map<string, Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>>();
let seq = 0;

function ask<T>(group: string, req: ProofRequest, cancelEarlier = false): Promise<T> {
  if (typeof Worker === 'undefined') return Promise.resolve(answer(req) as T);
  if (cancelEarlier) cancel(group);
  let w = workers.get(group);
  if (!w) {
    try { w = new Worker(new URL('./proof-worker.ts', import.meta.url), { type: 'module' }); } catch { return Promise.resolve(answer(req) as T); }
    const mine = w, calls = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>();
    workers.set(group, mine); pending.set(group, calls);
    mine.onmessage = (e: MessageEvent) => {
      const c = calls.get(e.data.id); calls.delete(e.data.id);
      if (!c) return;
      if (e.data.error) c.reject(new Error(e.data.error)); else c.resolve(e.data.result as never);
    };
  }
  const id = ++seq;
  return new Promise<T>((resolve, reject) => { pending.get(group)!.set(id, { resolve: resolve as (v: never) => void, reject }); w!.postMessage({ id, req }); });
}

// Stop the work of one group; whoever was waiting hears that it was cancelled.
export function cancel(group: string): void {
  workers.get(group)?.terminate(); workers.delete(group);
  pending.get(group)?.forEach((c) => c.reject(new Error('cancelled'))); pending.delete(group);
}

export const fixInWorker = (pieces: P[], lane: LaneSetting): Promise<Fixed> => ask('fix', { kind: 'fix', pieces, lane });
export const barsInWorker = (pieces: P[], lane: LaneSetting, budget = workSeconds(40)): Promise<FixedBars> => ask('fix', { kind: 'bars', pieces, lane, budget });
export const adviceInWorker = (pieces: P[], lane: LaneSetting, budget = workSeconds(10)): Promise<Advice[]> => ask('advice', { kind: 'advice', pieces, lane, budget }, true); // in a worker the page does not freeze, so the tries get more work than the old 1.5 s
export const clearedInWorker = (course: CourseData): Promise<boolean> => ask('cleared', { kind: 'cleared', course }, true);
export const provesInWorker = (pieces: P[], lane: LaneSetting): Promise<boolean> => ask('proves', { kind: 'proves', pieces, lane }, true);
