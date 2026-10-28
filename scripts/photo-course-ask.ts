// Stage 1 of the CC-52 experiment (runs where the Baseten key lives): ask Muse Spark Open for a layout for each photo, save the raw replies.
// Usage: npx tsx scripts/photo-course-ask.ts [runs=2]     Stage 2 (proof, Fix it, scoring) is scripts/photo-course-score.ts and needs no key.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_TOKENS, MODEL, URL_CHAT } from '../functions/api/designer';
import { PHOTO_PROMPT } from '../src/slice/photo-course';

const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no key file');
const runs = Number(process.argv[2] ?? 2);
const keyFile = JSON.parse(readFileSync('data/eval/photo-course/answer-key.json', 'utf8')) as { photos: Record<string, { file: string }> };
mkdirSync('data/eval/photo-course/outputs', { recursive: true });
const small = join(tmpdir(), 'cc52-small.jpg');

for (const [id, { file }] of Object.entries(keyFile.photos)) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', "scale='min(768,iw)':-2", '-q:v', '4', small]); // what the browser sends: at most 768 px wide
  const url = `data:image/jpeg;base64,${readFileSync(small).toString('base64')}`;
  for (let run = 1; run <= runs; run++) {
    const t0 = Date.now();
    const res = await fetch(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: PHOTO_PROMPT }, { role: 'user', content: [{ type: 'text', text: 'Here is the photo.' }, { type: 'image_url', image_url: { url } }] }] }) });
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: Record<string, unknown> };
    const out = { photo: id, run, status: res.status, ms: Date.now() - t0, imageBytes: readFileSync(small).length, usage: data.usage ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens, total_tokens: data.usage.total_tokens } : null, reply: (data.choices?.[0]?.message?.content ?? '').trim() };
    writeFileSync(`data/eval/photo-course/outputs/${id}.run${run}.json`, JSON.stringify(out, null, 2) + '\n');
    console.log(id, run, res.status, `${out.ms} ms`, out.usage?.total_tokens, 'tokens', out.reply ? '' : 'EMPTY');
  }
}
