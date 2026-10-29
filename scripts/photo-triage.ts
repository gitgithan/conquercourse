// CC-123: ask Muse Spark Open (Baseten, laptop: the key is not on the VMs) whether each CC-110 photo will lift well, then compare with what really happened.
// Usage: npx tsx scripts/photo-triage.ts      Output: data/eval/cc-123-photo-triage/{outputs/<photo>.json,results.json,run.json}
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { MODEL, URL_CHAT } from '../functions/api/designer';

const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no key file');
const src = 'data/eval/cc-110-real-objects';
const dir = 'data/eval/cc-123-photo-triage';
mkdirSync(`${dir}/outputs`, { recursive: true });
const photos = JSON.parse(readFileSync(`${src}/photos.json`, 'utf8')) as { photo: string; label: string }[];
// What really happened in CC-110 (data/eval/cc-110-real-objects/README.md)
const OUTCOME: Record<string, 'good' | 'partly' | 'failed'> = { 'picnic-table': 'partly', 'railing-red': 'partly', 'log-driftwood': 'partly', 'fence-split-rail': 'failed' };
const PROMPT = (label: string) => `This photo is meant to become a 3D obstacle ("${label}") for a game, by cutting the object out and lifting it to a mesh. Judge only the photo. Reply with one JSON object and nothing else: {"score": 1-5, "problems": ["..."], "verdict": "good"|"partly"|"poor"}. Look for: the whole object in frame, one object, thin parts (legs, rails, wires), clutter or things in front, hard shadows, a flat side-on view.`;

const results: unknown[] = [];
let tokens = 0;
for (const p of photos) {
  const b64 = readFileSync(`${src}/inputs/${p.photo}.jpg`).toString('base64');
  const res = await fetch(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 6000, temperature: 0, messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT(p.label) }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }] }] }) });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
  const reply = data.choices?.[0]?.message?.content ?? '';
  tokens += data.usage?.total_tokens ?? 0;
  writeFileSync(`${dir}/outputs/${p.photo}.json`, JSON.stringify({ photo: p.photo, status: res.status, usage: data.usage ?? null, reply }, null, 2) + '\n');
  let j: { score?: number; problems?: string[]; verdict?: string } = {};
  try { j = JSON.parse(/\{[\s\S]*\}/.exec(reply)?.[0] ?? '{}'); } catch { /* unparsed stays empty */ }
  results.push({ photo: p.photo, label: p.label, status: res.status, predicted: j.verdict ?? null, score: j.score ?? null, problems: j.problems ?? [], outcome: OUTCOME[p.photo] ?? 'good' });
  console.log(p.photo, res.status, j.verdict, j.score);
}
const r = results as { predicted: string | null; outcome: string }[];
const agree = r.filter((x) => x.predicted === x.outcome || (x.predicted === 'poor' && x.outcome === 'failed')).length;
writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2) + '\n');
writeFileSync(`${dir}/run.json`, JSON.stringify({ model: MODEL, photos: photos.length, agree, total_tokens: tokens, date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
console.log('agree', agree, 'of', photos.length, 'tokens', tokens);
