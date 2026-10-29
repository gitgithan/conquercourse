// Share a course made in the editor (CC-136). The link carries the course itself (option A): no server, nothing stored.
// A link is only as safe as what it opens, so the course is cleaned on the way out and again on the way in.
import type { CourseData } from '../course/course';
import { b64url, pipe, unb64url } from '../sim/replay';

export const MAX_MADE_CHARS = 1700; // the packed course; with the keys the whole address stays under MAX_PARAM_CHARS (2000)
const MAX_RAW_CHARS = 60_000; // an unpacked course bigger than this is a bomb, not a course

// Looks only, or worked out again from the platforms: none of these change where a runner can stand, so they stay home.
const LOOKS_ONLY = ['scene', 'source', 'uMap', 'plan', 'routes', 'windows', 'shortcuts', 'designedShortcuts', 'off'] as const;

const KEYS = /^[A-Za-z0-9_]{1,24}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_TEXT = /^[\p{L}\p{N} _.,:;!?'()+\-/#]{0,120}$/u; // letters, digits and plain marks: no angle brackets, quotes or ampersands

/** The course without its looks, so it fits in a link. The platforms, holds, wall and the rest stay: those are what the simulator plays. */
export function shareable(course: CourseData): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(course as unknown as Record<string, unknown>) };
  for (const k of LOOKS_ONLY) delete out[k];
  return out;
}

function clean(v: unknown, depth: number): unknown {
  if (depth > 6) throw new Error('deep');
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e5) throw new Error('number'); return v; }
  if (typeof v === 'string') {
    if (!SAFE_TEXT.test(v) || v.includes('//') || v.includes('..')) throw new Error('text');
    return v;
  }
  if (Array.isArray(v)) {
    if (v.length > 400) throw new Error('long');
    return v.map((x) => clean(x, depth + 1));
  }
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as object)) {
      if (!KEYS.test(k) || BAD_KEYS.has(k)) throw new Error('key');
      out[k] = clean(x, depth + 1);
    }
    return out;
  }
  throw new Error('type');
}

const num = (v: unknown, lo: number, hi: number): boolean => typeof v === 'number' && v >= lo && v <= hi;

/** A course from outside, or null when anything about it is off. Key order is kept: the course hash depends on it. Cleaning twice gives the same course. */
export function cleanCourse(raw: unknown): CourseData | null {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const c = clean(raw, 0) as Record<string, unknown>;
    for (const k of LOOKS_ONLY) if (k in c) return null;
    const t = c.terrain as { platforms?: unknown; waterY?: unknown } | undefined;
    if (c.version !== 1 || typeof c.name !== 'string' || !num(c.startX, -1e4, 1e4) || !num(c.finishX, -1e4, 1e4) || !num(c.jumpSpeed, 1, 30)) return null;
    if (!t || !Array.isArray(t.platforms) || t.platforms.length < 1 || t.platforms.length > 60 || typeof t.waterY !== 'number') return null;
    for (const p of t.platforms as Record<string, unknown>[]) if (!p || !num(p.x0, -1e4, 1e4) || !num(p.x1, -1e4, 1e4) || !num(p.top, -1e3, 1e3)) return null;
    return c as unknown as CourseData;
  } catch { return null; }
}

/** The course a link would carry (cleaned, looks removed), or null when it cannot be cleaned. */
export const madeCourse = (course: CourseData): CourseData | null => cleanCourse(JSON.parse(JSON.stringify(shareable(course))));

const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function packCourse(course: CourseData): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(course));
  if (!canCompress) return 'r' + b64url(raw);
  return 'd' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
}

/** Open a packed course, or null when it is too big, damaged or not a course. */
export async function unpackCourse(packed: string): Promise<CourseData | null> {
  try {
    if (packed.length < 2 || packed.length > MAX_MADE_CHARS) return null;
    const body = unb64url(packed.slice(1));
    let raw: Uint8Array;
    if (packed[0] === 'r') raw = body;
    else if (packed[0] === 'd' && canCompress) raw = await inflateCapped(body);
    else return null;
    if (raw.length > MAX_RAW_CHARS) return null;
    return cleanCourse(JSON.parse(new TextDecoder().decode(raw)));
  } catch { return null; }
}

async function inflateCapped(z: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  void w.write(z as BufferSource).catch(() => {}); void w.close().catch(() => {});
  const reader = ds.readable.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > MAX_RAW_CHARS) { void reader.cancel(); throw new Error('bomb'); }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
