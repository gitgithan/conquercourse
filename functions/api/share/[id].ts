// GET /api/share/:id: the run and course a short id stands for (CC-219). Immutable once stored, so the edge may keep it a day.
import { readShare } from '../../../src/share/server';
import { d1Store, type Env } from '../share';

export const onRequestGet = async ({ params, env }: { params: { id?: string | string[] }; env: Env }): Promise<Response> => {
  if (env.SHARE === 'off') return new Response(JSON.stringify({ error: 'off' }), { status: 503, headers: { 'content-type': 'application/json' } });
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  try {
    const r = await readShare({ store: d1Store(env.DB) }, id);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': r.status === 200 ? 'public, max-age=86400' : 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
};
