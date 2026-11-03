// The Make screen survives leaving the page (CC-133, owner 2026-11-04): the photo, the outlines, the picks and the names are kept in this browser (IndexedDB),
// so a player can visit another page and come back to the same step without passing the outline step again. Nothing is uploaded; it is dropped after a day.
import type { Box } from '../slice/markbox';
import type { Shrunk } from '../slice/object-lift-client';
import type { FlowState, Found, Kind, Step } from './flow';

export interface WorkShape {
  step: Step; photo: Shrunk | null; fs: FlowState; kinds: Map<number, Kind>; names: Map<number, string>; made: { pieces: string[] }; madeAreas?: number[];
  cands: Found[]; people: Box[]; ticked: number[]; areas: { id: number; box: Box; label: string; cutout?: string }[]; segMsg: string;
}
export interface SavedWork { v: 1; savedAt: number; madeAreas?: number[]; step: Step; photo: Shrunk; fs: FlowState; kinds: [number, Kind][]; names: [number, string][]; made: string[]; cands: Found[]; people: Box[]; ticked: number[]; areas: WorkShape['areas']; segMsg: string }

export const SESSION_LIFE_MS = 24 * 3_600_000;
const STEP_IDS: readonly string[] = ['photo', 'segment', 'make'];

export function snapshotWork(w: WorkShape, now = Date.now()): SavedWork | null {
  if (!w.photo) return null;
  return { v: 1, savedAt: now, step: w.step, photo: w.photo, fs: w.fs, kinds: [...w.kinds], names: [...w.names], made: [...w.made.pieces], madeAreas: [...(w.madeAreas ?? [])], cands: w.cands, people: w.people, ticked: w.ticked, areas: w.areas, segMsg: w.segMsg };
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** The saved work as the page keeps it, or null when it is missing, malformed or older than a day. */
export function restoreWork(s: unknown, now = Date.now()): WorkShape | null {
  const o = s as Partial<SavedWork> | null;
  if (!o || o.v !== 1 || !isNum(o.savedAt) || now - o.savedAt > SESSION_LIFE_MS || o.savedAt > now + 60_000) return null;
  const p = o.photo;
  if (!p || typeof p.image !== 'string' || typeof p.thumb !== 'string' || !isNum(p.width) || !isNum(p.height) || typeof p.sha256 !== 'string' || !/^[0-9a-f]{8,64}$/.test(p.sha256)) return null;
  if (typeof o.step !== 'string' || !STEP_IDS.includes(o.step) || !o.fs || typeof o.fs !== 'object') return null;
  if (![o.kinds, o.names, o.made, o.cands, o.people, o.ticked, o.areas].every(Array.isArray)) return null;
  return {
    step: o.step, photo: p, fs: o.fs, kinds: new Map(o.kinds), names: new Map(o.names), made: { pieces: [...(o.made as string[])] }, madeAreas: Array.isArray(o.madeAreas) ? o.madeAreas.filter(isNum) : [],
    cands: o.cands as Found[], people: o.people as Box[], ticked: o.ticked as number[], areas: o.areas as WorkShape['areas'], segMsg: typeof o.segMsg === 'string' ? o.segMsg : '',
  };
}
/** A cheap stand-in for "did anything change" so the page can save only when it did. */
export const workSignature = (w: WorkShape): string => [w.step, w.photo?.sha256 ?? '', w.cands.length, w.cands.map((c) => (c.confirmed ? 1 : 0)).join(''), w.ticked.join(','), [...w.kinds].join(';'), [...w.names].join(';'), w.areas.length, w.made.pieces.join(","), (w.madeAreas ?? []).join(","), w.segMsg, JSON.stringify(w.fs)].join('|');

const DB = 'cc-make-session', STORE = 'kv', KEY = 'work';
const open = (): Promise<IDBDatabase> => new Promise((ok, no) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((ok, no) => { const r = f(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
};
export const saveSession = async (s: SavedWork): Promise<void> => { try { await run('readwrite', (st) => st.put(s, KEY)); } catch { /* not kept after this visit */ } };
export const loadSession = async (): Promise<WorkShape | null> => { try { return restoreWork(await run('readonly', (st) => st.get(KEY))); } catch { return null; } };
export const clearSession = async (): Promise<void> => { try { await run('readwrite', (st) => st.delete(KEY) as IDBRequest<undefined>); } catch { /* nothing to clear */ } };
