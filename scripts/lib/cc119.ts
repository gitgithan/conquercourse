// Shared by the CC-120 and CC-121 experiments: the private key (read from a file, never printed), token counting, photo shrinking, a small pool.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '') ?? '';
if (!key) throw new Error('needs the private Baseten key file');
export const PRICE = { in: 1.25, out: 4.25 }; // USD per million tokens, Muse Spark Open on Baseten (docs/research/meta-rules-api.md)
export const tokens = { in: 0, out: 0 };
export const costUsd = () => +((tokens.in * PRICE.in + tokens.out * PRICE.out) / 1e6).toFixed(3);
export const counting: typeof fetch = async (u, init) => {
  const res = await fetch(u, init);
  try { const u2 = ((await res.clone().json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage; tokens.in += u2?.prompt_tokens ?? 0; tokens.out += u2?.completion_tokens ?? 0; } catch { /* no usage */ }
  return res;
};

export function shrink(src: string, name: string, box?: number[]): string {
  const out = join(tmpdir(), `cc119-${name}.jpg`);
  const crop = box ? `crop=min(${box[2] - box[0]}\\,iw-${box[0]}):min(${box[3] - box[1]}\\,ih-${box[1]}):${box[0]}:${box[1]},` : '';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `${crop}scale='min(768,iw)':-2`, '-q:v', '4', out]);
  return `data:image/jpeg;base64,${readFileSync(out).toString('base64')}`;
}

export async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await f(items[k]); } }));
  return out;
}

