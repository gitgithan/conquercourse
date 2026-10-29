import { describe, expect, it, vi } from 'vitest';

// CC-211: when the simulator finds no path, the community server saves nothing (the proof is replaced by "not cleared").
vi.mock('../src/park/fit', async (orig) => ({ ...(await orig<typeof import('../src/park/fit')>()), proveCourse: () => ({ cleared: false }) }));
const { onRequestPost } = await import('../functions/api/community');

describe('the community server refuses a course with no path', () => {
  it('answers 422 and writes no row', async () => {
    const ins: unknown[] = [];
    const env = { DB: { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({ run: async () => { if (sql.startsWith('INSERT')) ins.push(v); return {}; }, first: async () => ({ n: 0 }), all: async () => ({ results: [] }) }) }) } } as never;
    const body = { session: 'abcdef12-3456', name: 'Library steps', nick: 'sam', confirm: true, width: 800, height: 600, image: 'data:image/jpeg;base64,' + 'A'.repeat(1000), boxes: [{ phrase: 'wall', box: [450, 250, 700, 400] }] };
    const r = await onRequestPost({ request: new Request('https://x/api/community', { method: 'POST', body: JSON.stringify(body) }), env });
    expect(r.status).toBe(422);
    expect(ins).toEqual([]);
  });
});
