// CC-133: sends src/sim files to Muse Wonder in chunks and saves prompt, files sent, raw reply, usage and cost.
// The key is read from ~/.config/ninja/meta.env by code and never printed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import https from 'node:https';

// fetch gives up waiting for headers after 5 minutes; a long reasoning reply needs longer, so this posts with node:https and a 20-minute limit
const post = (url, headers, body) => new Promise((resolve, reject) => {
  const req = https.request(url, { method: 'POST', headers, timeout: 20 * 60 * 1000 }, (res) => { let t = ''; res.setEncoding('utf8'); res.on('data', (c) => (t += c)); res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, text: async () => t })); });
  req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(body);
});

const OUT = 'data/eval/cc-wonder-review';
const PRICE_IN = 4.0, PRICE_OUT = 20.0; // USD per 1M tokens, muse-wonder-1.0 (docs/research/muse-wonder.md)
const CAP_USD = 5;

const CHUNKS = {
  'a-body': ['world', 'runner', 'terrain', 'units', 'landing', 'wall', 'roll', 'drop'],
  'b-moves': ['rope', 'holds', 'vault', 'climb', 'trampoline', 'needs', 'needs-limits', 'energy', 'band'],
  'c-search': ['ideal', 'shortcuts', 'replay', 'predict', 'launch-window'],
  'd-contraptions': ['cart', 'beam', 'drone', 'recoil', 'trebuchet', 'drums'],
};

const env = Object.fromEntries(readFileSync(`${homedir()}/.config/ninja/meta.env`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const base = env.META_BASE_URL || 'https://api.meta.ai/v1';

const SCHEMA = { type: 'object', required: ['claims'], additionalProperties: false, properties: { claims: { type: 'array', items: { type: 'object', required: ['file', 'line', 'summary', 'failing_input', 'why', 'confidence'], additionalProperties: false, properties: { file: { type: 'string' }, line: { type: 'integer' }, summary: { type: 'string' }, failing_input: { type: 'string' }, why: { type: 'string' }, confidence: { enum: ['low', 'medium', 'high'] } } } } } };

const PROMPT = (files) => `You are reviewing the physics simulator of a browser game (TypeScript, deterministic, fixed 120 Hz step, pure functions, Earth gravity only). Below are source files with line numbers.
Find real bugs: wrong physics, unit mix-ups, off-by-one, division by zero or NaN, state that is not reset, results that depend on iteration order or wall-clock time (the simulator must replay the same keys to the same result), and edge cases that break a promise the comments make.
Rules:
- Report only bugs you can argue from the code shown. Do not report style, naming or missing features.
- For each, give the file, the line number printed in the listing, one sentence of summary, a concrete failing input (numbers a test could use), and why it fails.
- Give a confidence of low, medium or high. If you find nothing, return an empty list.

${files}`;

const only = process.argv[2];
mkdirSync(`${OUT}/raw`, { recursive: true });
let total = 0;
const runs = [];
for (const [name, list] of Object.entries(CHUNKS)) {
  if (only && only !== name) continue;
  const listing = list.map((f) => { const src = readFileSync(`src/sim/${f}.ts`, 'utf8').split('\n'); return `=== src/sim/${f}.ts ===\n` + src.map((l, i) => `${i + 1}: ${l}`).join('\n'); }).join('\n\n');
  const prompt = PROMPT(listing);
  if (total >= CAP_USD) throw new Error('cost cap reached');
  const body = { model: 'muse-wonder-1.0', messages: [{ role: 'user', content: prompt }], max_tokens: 40000, reasoning_effort: 'high', response_format: { type: 'json_schema', json_schema: { name: 'claims', schema: SCHEMA } } };
  const t0 = Date.now();
  const res = await post(base + '/chat/completions', { 'content-type': 'application/json', authorization: `Bearer ${env.META_API_KEY}` }, JSON.stringify(body));
  const text = await res.text();
  writeFileSync(`${OUT}/raw/${name}.response.json`, text);
  writeFileSync(`${OUT}/raw/${name}.prompt.txt`, prompt);
  let out; try { out = JSON.parse(text); } catch { throw new Error(`${name}: not JSON, http ${res.status}`); }
  if (!res.ok) throw new Error(`${name}: http ${res.status} ${text.slice(0, 300)}`);
  const u = out.usage || {};
  const usd = +(((u.prompt_tokens || 0) * PRICE_IN + (u.completion_tokens || 0) * PRICE_OUT) / 1e6).toFixed(4);
  total += usd;
  runs.push({ chunk: name, files: list, prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, seconds: +((Date.now() - t0) / 1000).toFixed(1), usd });
  console.log(name, JSON.stringify(runs.at(-1)));
}
writeFileSync(`${OUT}/run${only ? '-' + only : ''}.json`, JSON.stringify({ date: '2026-10-29', model: 'muse-wonder-1.0', reasoning_effort: 'high', price_usd_per_1m: { in: PRICE_IN, out: PRICE_OUT }, cap_usd: CAP_USD, total_usd: +total.toFixed(4), runs }, null, 2) + '\n');
console.log('total usd', total.toFixed(4));
