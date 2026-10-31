// The provider slots of the character pipeline, as the server sees them (CC-108). A provider turns a prompt into a job and a job into a packaged character.
// Route A runs on Modal (pipelines/character_maker.py: submit and status). Tripo is a stub that answers "not configured" until someone adds a key.
// To add a provider: write one object that satisfies Provider, add it to PROVIDERS, and add its Python maker in pipelines/charmaker/providers/ (docs/character-pipeline.md).
export interface Env { DB?: unknown; CC_CHAR_TOKEN?: string; CC_CHAR_SUBMIT_URL?: string; CC_CHAR_STATUS_URL?: string; CC_CHAR_LIMITS?: string; TRIPO_API_KEY?: string; BASETEN_API_KEY?: string }

export type JobState =
  | { state: 'running'; stage?: string; attempt?: number }
  | { state: 'done'; glb: string; thumb: string; meta: Record<string, unknown> } // base64 glb and base64 webp
  | { state: 'failed'; reason: string; refund?: boolean };

export interface Provider {
  id: string;
  label: string;
  configured(env: Env): boolean;
  submit(prompt: string, env: Env, fetcher: typeof fetch): Promise<{ id: string }>;
  status(id: string, env: Env, fetcher: typeof fetch): Promise<JobState>;
}

const MODAL_HOST = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+(\.[a-z0-9-]+)?\.modal\.run\/?$/; // the app host may carry a region
export const JOB_ID = /^fc-[A-Za-z0-9]{10,40}$/;

async function modalCall(url: string, payload: unknown, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Record<string, unknown>;
}

export const routeA: Provider = {
  id: 'route-a',
  label: 'Muse Image + SAM 3.1 + SAM 3D Objects + our rig',
  configured: (env) => !!(env.CC_CHAR_TOKEN && env.CC_CHAR_SUBMIT_URL && env.CC_CHAR_STATUS_URL && MODAL_HOST.test(env.CC_CHAR_SUBMIT_URL) && MODAL_HOST.test(env.CC_CHAR_STATUS_URL)),
  async submit(prompt, env, fetcher) {
    const out = await modalCall(env.CC_CHAR_SUBMIT_URL!, { token: env.CC_CHAR_TOKEN, prompt }, fetcher);
    if (typeof out.id !== 'string' || !JOB_ID.test(out.id)) throw new Error('no job id');
    return { id: out.id };
  },
  async status(id, env, fetcher) {
    const out = await modalCall(env.CC_CHAR_STATUS_URL!, { token: env.CC_CHAR_TOKEN, id }, fetcher);
    if (out.state === 'done' && typeof out.glb === 'string' && typeof out.thumb === 'string') return { state: 'done', glb: out.glb, thumb: out.thumb, meta: (out.meta ?? {}) as Record<string, unknown> };
    if (out.state === 'failed') return { state: 'failed', reason: String(out.reason ?? 'failed').slice(0, 200), refund: out.refund !== false };
    return { state: 'running', stage: typeof out.stage === 'string' ? out.stage : undefined, attempt: typeof out.attempt === 'number' ? out.attempt : undefined };
  },
};

/** The slot kept open for Tripo (about 110 credits a character; no credits are bought by this repo). It never starts a job. */
export const tripo: Provider = {
  id: 'tripo',
  label: 'Tripo (not configured)',
  configured: () => false,
  async submit() { throw new Error('not configured'); },
  async status() { return { state: 'failed', reason: 'not configured', refund: true }; },
};

export const PROVIDERS: Record<string, Provider> = { [routeA.id]: routeA, [tripo.id]: tripo };
export const DEFAULT_PROVIDER = routeA.id;
