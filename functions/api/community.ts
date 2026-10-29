// /api/community: the community's obstacle courses.
//   POST  publish a course (a photo and the boxes on it); it is stored as 'pending' until the owner approves it.
//   GET   (no id) the list of approved courses without photos; (?id=N) one approved course with its boxes.
// Defences: small body, whitelisted fields and phrases, a honeypot, a jpeg-only photo of limited size, and at most 3 publishes per session per day.
import { fitPrimitives, proveCourse, type ParkObject } from '../../src/park/fit';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> } }
interface Env { DB: { prepare(sql: string): Stmt } }

export const PHRASES = ['bench', 'wall', 'low wall', 'steps', 'rail', 'ledge', 'platform', 'mound', 'person']; // kept equal to src/park/fit.ts (a test checks)
export const MAX_IMAGE_CHARS = 460_000; // about 340 KB of jpeg
const MAX_BODY = MAX_IMAGE_CHARS + 6000;

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });
const text = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// What a published course may contain; returns the cleaned course or the reason it is refused.
export function cleanCourse(b: Record<string, unknown>): { ok: true; course: { name: string; nick: string; width: number; height: number; boxes: unknown[]; image: string } } | { ok: false; error: string } {
  const name = text(b.name, 60), nick = text(b.nick, 30);
  if (name.length < 3) return { ok: false, error: 'give the course a name of at least 3 letters' };
  if (b.confirm !== true) return { ok: false, error: 'please confirm the photo rules' };
  const width = Number(b.width), height = Number(b.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100 || width > 2400 || height > 2400) return { ok: false, error: 'bad photo size' };
  const image = String(b.image ?? '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_IMAGE_CHARS) return { ok: false, error: 'the photo must be a jpeg under 340 KB' };
  if (!Array.isArray(b.boxes) || b.boxes.length < 1 || b.boxes.length > 12) return { ok: false, error: 'draw between 1 and 12 boxes' };
  const boxes: unknown[] = [];
  for (const raw of b.boxes as Record<string, unknown>[]) {
    const phrase = String(raw?.phrase ?? '');
    const box = raw?.box as unknown[];
    if (!PHRASES.includes(phrase)) return { ok: false, error: 'unknown kind of obstacle' };
    if (!Array.isArray(box) || box.length !== 4 || box.some((v) => !Number.isFinite(Number(v)))) return { ok: false, error: 'bad box' };
    const [x0, y0, x1, y1] = box.map((v) => Math.round(Number(v)));
    if (x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 - x0 < 5 || y1 - y0 < 5) return { ok: false, error: 'a box is outside the photo or too small' };
    const out: Record<string, unknown> = { id: boxes.length + 1, phrase, box: [x0, y0, x1, y1], score: 1 };
    if (raw.heightM !== undefined && raw.heightM !== null && raw.heightM !== '') {
      const h = Number(raw.heightM);
      if (!(h >= 0.1 && h <= 3)) return { ok: false, error: 'a typed height must be between 0.1 and 3 m' };
      out.heightM = Math.round(h * 100) / 100;
    }
    boxes.push(out);
  }
  if (!boxes.some((o) => (o as { phrase: string }).phrase !== 'person')) return { ok: false, error: 'add at least one obstacle, not only a person' };
  return { ok: true, course: { name, nick: nick || 'anonymous', width, height, boxes, image } };
}

/** CC-211: the server proves the course again with the simulator; the browser's "cleared" is not trusted. */
export function hasPath(boxes: unknown[], name: string): boolean {
  try { const prims = fitPrimitives(boxes as ParkObject[]); return prims.length > 0 && proveCourse(prims, name).cleared; } catch { return false; }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too big' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
  const session = text(b.session, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(session)) return json({ error: 'bad session' }, 400);
  const c = cleanCourse(b);
  if (!c.ok) return json({ error: c.error }, 400);
  if (!hasPath(c.course.boxes, c.course.name)) return json({ error: 'the simulator found no path on this course, so it cannot be shared' }, 422);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM community WHERE session = ? AND ts > datetime('now', '-1 day')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 3) return json({ error: 'You have shared 3 courses today. Please come back tomorrow.' }, 429);
  const { name, nick, width, height, boxes, image } = c.course;
  await env.DB.prepare("INSERT INTO community (ts, session, status, name, nick, width, height, boxes, image) VALUES (datetime('now'), ?, 'pending', ?, ?, ?, ?, ?, ?)")
    .bind(session, name, nick, width, height, JSON.stringify(boxes), image).run();
  return json({ ok: true, status: 'pending' });
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  const cache = { 'cache-control': 'public, max-age=60' };
  if (Number.isInteger(id) && id > 0) {
    const row = await env.DB.prepare("SELECT id, name, nick, width, height, boxes FROM community WHERE id = ? AND status = 'approved' AND reports < 3").bind(id).first<Record<string, unknown>>();
    if (!row) return json({ error: 'not found' }, 404);
    return json({ ...row, boxes: JSON.parse(String(row.boxes)) }, 200, cache);
  }
  const rows = await env.DB.prepare("SELECT id, ts, name, nick, width, height, boxes FROM community WHERE status = 'approved' AND reports < 3 ORDER BY id DESC LIMIT 60").bind().all<Record<string, unknown>>();
  return json({ courses: rows.results.map((r) => ({ ...r, boxes: JSON.parse(String(r.boxes)) })) }, 200, cache);
};
