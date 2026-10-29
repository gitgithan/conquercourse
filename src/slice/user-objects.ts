// The player's own 3D objects (CC-221), kept in this browser only (IndexedDB): the .glb plus its provenance record.
// Nothing is uploaded to share it. Saved worlds refer to an object as `user:<id>`. A browser without IndexedDB just does not keep them.
import type { Provenance } from './provenance';

export interface UserObject { id: string; glb: ArrayBuffer; prov: Provenance }
const DB = 'cc-user-objects', STORE = 'objects';

const open = (): Promise<IDBDatabase> => new Promise((ok, no) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((ok, no) => { const r = f(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
};

/** blob urls of the objects loaded this visit, so the 3D view can draw them */
export const userObjectUrls = new Map<string, string>();
export const userSrc = (id: string): string => `user:${id}`;
export const saveUserObject = (o: UserObject): Promise<IDBValidKey> => run('readwrite', (s) => s.put(o));
export const getUserObject = (id: string): Promise<UserObject | undefined> => run('readonly', (s) => s.get(id) as IDBRequest<UserObject | undefined>);
export const listUserObjects = (): Promise<UserObject[]> => run('readonly', (s) => s.getAll() as IDBRequest<UserObject[]>);
export const deleteUserObject = (id: string): Promise<undefined> => run('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
