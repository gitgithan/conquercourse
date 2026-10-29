// CC-197: the toast queue: new ones go below, nothing overlaps, each leaves by itself, the same words are not shown twice.
import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, ToastQueue } from '../src/ui/toast-stack';

describe('toast queue', () => {
  it('appends a new toast below the older ones', () => {
    const q = new ToastQueue();
    q.push('first', 100, 0); q.push('second', 100, 5); q.push('third', 100, 9);
    expect(q.live.map((t) => t.text)).toEqual(['first', 'second', 'third']);
  });
  it('lets each toast leave at its own time, the others stay', () => {
    const q = new ToastQueue();
    q.push('a', 50, 0); q.push('b', 120, 0);
    expect(q.tick(49)).toEqual([]);
    expect(q.tick(50).map((t) => t.text)).toEqual(['a']);
    expect(q.live.map((t) => t.text)).toEqual(['b']);
    expect(q.tick(50)).toEqual([]); // a leaves once
    expect(q.tick(130).map((t) => t.text)).toEqual(['b']);
  });
  it('keeps a leaving toast until it is removed, then drops it', () => {
    const q = new ToastQueue(); const a = q.push('a', 10, 0);
    q.tick(10); expect(q.items).toHaveLength(1); expect(q.live).toHaveLength(0);
    q.remove(a.id); expect(q.items).toHaveLength(0);
  });
  it('shows the same words once and only adds time', () => {
    const q = new ToastQueue();
    q.push('Firm landing.', 90, 0); q.push('Firm landing.', 90, 60);
    expect(q.live).toHaveLength(1);
    expect(q.live[0].until).toBe(150);
  });
  it('never shows more than the cap: the oldest makes room', () => {
    const q = new ToastQueue();
    for (let i = 0; i < MAX_TOASTS + 2; i++) q.push(`t${i}`, 1000, i);
    expect(q.live).toHaveLength(MAX_TOASTS);
    expect(q.live[0].text).toBe('t2');
    expect(q.items.filter((t) => t.leaving).map((t) => t.text)).toEqual(['t0', 't1']);
  });
  it('reports how long the longest showing toast has left', () => {
    const q = new ToastQueue();
    expect(q.remaining(0)).toBe(0);
    q.push('a', 100, 0); q.push('b', 40, 0);
    expect(q.remaining(30)).toBe(70);
  });
});
