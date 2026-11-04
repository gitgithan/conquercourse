import { afterEach, expect, it, vi } from 'vitest';
import { rolesInWorker, type RoleWorker } from '../src/slice/roles-client';
import type { RoleSuggestion } from '../src/slice/roles';
const lane = { angle: 0, offset: 0, level: 0 };
const item: RoleSuggestion = { piece: 1, role: 'wall', move: 'wall', words: 'Use the block as a wall.', change: { role: 'wall' }, proved: true };
function fixture() {
  const worker: RoleWorker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null, onmessageerror: null };
  return worker;
}
afterEach(() => vi.useRealTimers());
it('sends the question to a worker, streams progress, and returns only proven suggestions', async () => {
  const w = fixture(), progress = vi.fn(), task = rolesInWorker([], lane, { only: 4, progress }, () => w);
  expect(w.postMessage).toHaveBeenCalledWith({ id: 1, pieces: [], lane, opts: { budgetMs: 40000, only: 4 } });
  const p = { index: 1, total: 2, candidate: item, verified: [item] };
  w.onmessage?.({ data: { id: 1, progress: { done: 0, of: 2, candidate: item, verified: [item] } } }); expect(progress).toHaveBeenCalledWith(p);
  w.onmessage?.({ data: { id: 1, items: [item, { ...item, proved: null }, { ...item, proved: false }], limited: false } });
  await expect(task.promise).resolves.toEqual({ items: [item], limited: false });
  expect(w.terminate).toHaveBeenCalledOnce(); task.cancel(); expect(w.terminate).toHaveBeenCalledOnce();
});
it('cancels a blocked worker immediately and ignores its late answer', async () => {
  const w = fixture(), task = rolesInWorker([], lane, {}, () => w), rejected = expect(task.promise).rejects.toThrow('cancelled');
  task.cancel(); w.onmessage?.({ data: { id: 1, items: [item], limited: false } });
  await rejected; expect(w.terminate).toHaveBeenCalledOnce();
});
it('enforces the page-side deadline even when an individual proof never answers', async () => {
  vi.useFakeTimers(); const w = fixture(), task = rolesInWorker([], lane, { budgetMs: 40 }, () => w);
  w.onmessage?.({ data: { id: 1, progress: { done: 1, of: 3, candidate: item, verified: [item] } } });
  vi.advanceTimersByTime(40);
  await expect(task.promise).resolves.toEqual({ items: [item], limited: true }); expect(w.terminate).toHaveBeenCalledOnce();
});
it('reports worker failure and clears pending work', async () => {
  const w = fixture(), task = rolesInWorker([], lane, {}, () => w), rejected = expect(task.promise).rejects.toThrow('worker stopped');
  const preventDefault = vi.fn(); w.onerror?.({ preventDefault }); await rejected;
  expect(preventDefault).toHaveBeenCalledOnce(); expect(w.terminate).toHaveBeenCalledOnce();
});
it('does not fall back to synchronous simulation when workers cannot start or cloning fails', async () => {
  const failed = rolesInWorker([], lane, {}, () => { throw new Error('unavailable'); });
  await expect(failed.promise).rejects.toThrow('No search was run');
  const w = fixture(); w.postMessage = () => { throw new Error('clone'); };
  await expect(rolesInWorker([], lane, {}, () => w).promise).rejects.toThrow('No search was run'); expect(w.terminate).toHaveBeenCalledOnce();
});
