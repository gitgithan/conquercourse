// CC-124: group the feedback items (the product owner's playtest rounds 1 to 6, and the free-text answers from the public form) into themes with Muse Spark Open.
// Runs where the Baseten key lives. Usage: npx tsx scripts/feedback-cluster.ts <public-answers.json> [runs=2]
// Inputs are read from docs/feedback/round-0*.md and the json file (an array of {id, text}); the model only assigns items to themes, every quote in the doc is copied from the source.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { MAX_TOKENS, MODEL, URL_CHAT } from '../functions/api/designer';

const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no key file');
const dir = 'data/eval/cc-124-feedback-clusters';
mkdirSync(`${dir}/outputs`, { recursive: true });
const publicAnswers = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { id: string; text: string }[];
const runs = Number(process.argv[3] ?? 2);

const items: { id: string; text: string }[] = [];
for (const f of readdirSync('docs/feedback').filter((n) => /^round-0\d\.md$/.test(n)).sort()) {
  for (const line of readFileSync(`docs/feedback/${f}`, 'utf8').split('\n')) {
    const m = /^- (R\d-[A-Z]+\d+[a-z]?(?:, R\d-[A-Z]+\d+[a-z]?)*)(?: \(([^)]*)\))?:?\s*(.*)$/.exec(line); // a line may carry several ids: they stay one item
    if (!m) continue;
    const text = (m[2] ? `${m[2]}${m[3] ? ': ' + m[3] : ''}` : m[3]).slice(0, 220);
    if (text) items.push({ id: items.some((i) => i.id === m[1]) ? `${m[1]}'` : m[1], text });
  }
}
items.push(...publicAnswers);
writeFileSync(`${dir}/items.json`, JSON.stringify(items, null, 2) + '\n');

const SYSTEM = [
  'You group feedback items from playtests of a ninja-warrior physics game into themes.',
  'Each item has an id and a short text. Make 8 to 14 themes. Every item goes in exactly one theme.',
  'Reply with one fenced ```json block only: {"themes":[{"name":"short name","about":"one plain sentence","ids":["R1-G1", ...]}]}.',
  'Never describe a person. Never show formulas.',
].join(' ');

for (let run = 1; run <= runs; run++) {
  const t0 = Date.now();
  const res = await fetch(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS * 5, temperature: 0.3, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: items.map((i) => `${i.id}: ${i.text}`).join('\n') }] }) });
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: Record<string, number> };
  writeFileSync(`${dir}/outputs/run${run}.json`, JSON.stringify({ run, status: res.status, ms: Date.now() - t0, usage: data.usage ?? null, reply: data.choices?.[0]?.message?.content ?? '' }, null, 2) + '\n');
  console.log(run, res.status, `${Date.now() - t0} ms`, data.usage?.total_tokens);
}
