// The page side of /api/community-items (CC-247): share a finished piece or wallpaper, list what is shared, delete your own.
// The browser's random player code (the same one the feedback form uses) is sent as a header; the server turns it into a one-way code and never keeps it.
import type { PublicItem } from './items';

export const sessionCode = (): string => {
  try { let s = localStorage.getItem('cc.session'); if (!s) { s = crypto.randomUUID(); localStorage.setItem('cc.session', s); } return s; } catch { return 'no-storage-session'; }
};

/** Which saved thing in this browser a shared item came from, so deleting the shared one also clears the local copy. */
const KEY = 'cc.shared';
export interface Link { kind: 'piece' | 'wallpaper'; local: string }
export const links = (): Record<string, Link> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Link>; } catch { return {}; } };
export const rememberLink = (serverId: string, l: Link): void => { try { localStorage.setItem(KEY, JSON.stringify({ ...links(), [serverId]: l })); } catch { /* the share still worked */ } };
export const forgetLink = (serverId: string): void => { try { const m = links(); delete m[serverId]; localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* nothing kept */ } };

export const toBase64 = (buf: ArrayBuffer): string => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

export interface ShareInput { kind: 'piece' | 'wallpaper'; name: string; thumb: string; glb?: ArrayBuffer; height_m?: number; course?: string }
export interface Shared { id: string; status: 'approved' | 'pending' }

export async function shareItem(inp: ShareInput): Promise<Shared> {
  const res = await fetch('/api/community-items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', session: sessionCode(), kind: inp.kind, name: inp.name, thumb: inp.thumb, glb: inp.glb ? toBase64(inp.glb) : undefined, height_m: inp.height_m, course: inp.course }) });
  let d: Record<string, unknown> = {};
  try { d = (await res.json()) as Record<string, unknown>; } catch { /* a broken reply is a failure below */ }
  if (!res.ok || typeof d.id !== 'string') throw new Error(typeof d.message === 'string' && d.message ? d.message : 'Sharing did not work. Try again in a minute.');
  return { id: d.id, status: d.status === 'approved' ? 'approved' : 'pending' };
}

export interface SharedPage { items: PublicItem[]; next: string | null }
/** One page of the shared list. Search is by name on the server; `cursor` is the `next` of the page before. */
export async function listSharedPage(opt: { q?: string; kind?: string; cursor?: string } = {}): Promise<SharedPage> {
  const p = new URLSearchParams();
  if (opt.q) p.set('q', opt.q); if (opt.kind) p.set('kind', opt.kind); if (opt.cursor) p.set('cursor', opt.cursor);
  const res = await fetch(`/api/community-items${p.size ? `?${p}` : ''}`, { headers: { 'x-cc-session': sessionCode() } });
  if (!res.ok) return { items: [], next: null };
  const d = (await res.json()) as { items?: PublicItem[]; next?: string | null };
  return { items: d.items ?? [], next: d.next ?? null };
}
export async function listShared(): Promise<PublicItem[]> { return (await listSharedPage()).items; }

/** Only the owner's code can delete; the server answers 404 to anyone else. */
export async function deleteShared(id: string): Promise<boolean> {
  const res = await fetch('/api/community-items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', session: sessionCode(), id }) });
  return res.ok;
}
