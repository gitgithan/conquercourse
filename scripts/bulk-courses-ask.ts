// Stage 1 of CC-122 (runs where the Baseten key lives, plain network calls): ask Muse Spark Open for about 100 course layouts, each aimed at a named move.
// Usage: npx tsx scripts/bulk-courses-ask.ts [count=100]     Stage 2 (proof, Fix it, diversity) is scripts/bulk-courses-score.ts and needs no key.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { MAX_TOKENS, MODEL, URL_CHAT } from '../functions/api/designer';

const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no key file');
const count = Number(process.argv[2] ?? 100);
const dir = 'data/eval/cc-122-bulk-courses';
mkdirSync(`${dir}/outputs`, { recursive: true });

export const BULK_PROMPT = [
  'You design one course for a ninja-warrior physics game. A runner goes left to right along a 2 m wide lane.',
  'Reply with one short plain sentence about the idea, then one fenced ```json block holding {"items": [...]}, items in the order the runner meets them.',
  'Item kinds (all sizes in metres):',
  '{"kind":"ground","length":m} flat ground to run on;',
  '{"kind":"gap","width":m} a drop or water gap with no ground, to be jumped;',
  '{"kind":"block","length":m,"height":m} a raised piece (a step, a ledge, a box, a low wall, a tall wall); height is above the ground;',
  '{"kind":"bar","height":m} a bar to hang from, in the air; height is above the ground.',
  'What the runner can do: jump about 1 m high and 4 m far; vault a block 0.35 to 1.3 m high; climb a block 1.0 m or more high by catching its edge; hang from a bar up to 2.7 m high and swing between bars across wide water.',
  'Start and end with ground. At most 10 items. Earth physics only. Never show formulas. Never mention a person.',
].join(' ');

const THEMES = [
  'a wide gap that needs a long run-up and jump',
  'a chain of blocks of rising height, like stairs of different sizes',
  'a block to vault, then a gap to jump',
  'a tall wall to climb, then a drop to the ground',
  'two or three bars to swing across wide water',
  'a gap that a bar could be used to skip across',
  'a high platform, a drop to the ground, then another gap',
  'low blocks close together that set a rhythm',
  'a mix of a vault, a gap and a bar',
  'something unusual that a designer would not think of',
];
const SETTINGS = ['a school yard', 'a harbour', 'a quarry', 'a market square', 'a rooftop', 'a railway yard', 'a beach', 'an old fort', 'a campus', 'a farm'];

async function ask(i: number): Promise<void> {
  const file = `${dir}/outputs/${String(i).padStart(3, '0')}.json`;
  if (existsSync(file)) return; // reasoning can use the whole cap and leave an empty reply: delete those files and run again (the cap is 3x for that reason)
  const theme = THEMES[i % THEMES.length], setting = SETTINGS[Math.floor(i / THEMES.length) % SETTINGS.length], level = 1 + (Math.floor(i / 2) % 5);
  const user = `Design a course set in ${setting} built around: ${theme}. Difficulty ${level} out of 5 (1 is gentle, 5 asks for a tight, precise run).`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const res = await fetch(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS * 3, temperature: 1, messages: [{ role: 'system', content: BULK_PROMPT }, { role: 'user', content: user }] }) });
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 4000 * attempt)); continue; }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: Record<string, number> };
    writeFileSync(file, JSON.stringify({ index: i, theme, setting, level, status: res.status, ms: Date.now() - t0, usage: data.usage ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens, total_tokens: data.usage.total_tokens } : null, reply: data.choices?.[0]?.message?.content ?? '' }, null, 2) + '\n');
    console.log(i, res.status, `${Date.now() - t0} ms`, data.usage?.total_tokens, 'tokens');
    return;
  }
  console.log(i, 'gave up');
}

const todo = Array.from({ length: count }, (_, i) => i);
await Promise.all(Array.from({ length: 4 }, async () => { for (let i = todo.shift(); i !== undefined; i = todo.shift()) await ask(i); }));
