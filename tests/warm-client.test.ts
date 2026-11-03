import { beforeEach, describe, expect, it } from 'vitest';
import { resetWarmUp, warmUp } from '../src/slice/warm-client';

describe('warm-up call from the page (CC-133)', () => {
  beforeEach(resetWarmUp);
  const spy = () => { const calls: string[] = []; const f = (async (_u: string, i: { body: string }) => { calls.push(JSON.parse(i.body).which); return {}; }) as unknown as typeof fetch; return { calls, f }; };
  it('sends once for each machine per page load', () => {
    const { calls, f } = spy();
    expect([warmUp('mask', f, false), warmUp('mask', f, false), warmUp('lift', f, false), warmUp('lift', f, false)]).toEqual([true, false, true, false]);
    expect(calls).toEqual(['mask', 'lift']);
  });
  it('sends nothing when the switch is off', () => {
    const { calls, f } = spy();
    expect(warmUp('mask', f, true)).toBe(false);
    expect(calls).toEqual([]);
  });
  it('ignores a failed or throwing call', async () => {
    expect(warmUp('mask', (async () => { throw new Error('down'); }) as unknown as typeof fetch, false)).toBe(true);
    expect(warmUp('lift', (() => { throw new Error('sync'); }) as unknown as typeof fetch, false)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
  });
});
