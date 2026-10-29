// Provenance of a 3D object (CC-221): which photo made it, with which box and settings, and who gets the credit.
// One clean JSON record per object, so a future database row can be the same shape. The photo itself is never stored: only its fingerprint (sha256).
export const PROVENANCE_VERSION = 1;
export type ObjectSource = 'library' | 'user';
export interface Provenance {
  version: number;
  id: string;
  glb: string;
  name: string;
  source: ObjectSource;
  photo: { sha256: string; width: number; height: number; id: string | null; url: string | null; stored: false };
  box: [number, number, number, number];
  label: string;
  height_m: number;
  height_source: 'typed' | 'typical' | 'library';
  pipeline: { name: string; model: string; seed: number; texture: number; pad_retry: boolean };
  credit: { author: string; licence: string; source_url: string | null; line: string };
  created: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const isBox = (b: unknown): b is [number, number, number, number] =>
  Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number' && Number.isFinite(v)) && b[0] < b[2] && b[1] < b[3] && b[0] >= 0 && b[1] >= 0;

/** The line shown under a selected piece, for example "Photo by Ana, CC BY 4.0". Own photos credit the player's own photo, with no name asked. */
export function creditLine(c: { author?: string; licence?: string }, source: ObjectSource): string {
  if (source === 'user') return 'From your own photo';
  const who = (c.author ?? '').trim() || 'unknown author';
  const lic = (c.licence ?? '').trim();
  return lic ? `Photo by ${who}, ${lic}` : `Photo by ${who}`;
}

/** Why a record is not clean, or an empty list when it is. */
export function problems(p: unknown): string[] {
  const out: string[] = [];
  const r = p as Partial<Provenance> | null;
  if (!r || typeof r !== 'object') return ['not an object'];
  if (r.version !== PROVENANCE_VERSION) out.push('version');
  for (const k of ['id', 'glb', 'name', 'label', 'created'] as const) if (typeof r[k] !== 'string' || !r[k]) out.push(k);
  if (r.source !== 'library' && r.source !== 'user') out.push('source');
  if (!r.photo || !HEX64.test(r.photo.sha256 ?? '') || !(r.photo.width > 0) || !(r.photo.height > 0) || r.photo.stored !== false) out.push('photo');
  if (!isBox(r.box)) out.push('box');
  else if (r.photo && (r.box[2] > r.photo.width || r.box[3] > r.photo.height)) out.push('box outside photo');
  if (typeof r.height_m !== 'number' || !(r.height_m >= 0.1 && r.height_m <= 6)) out.push('height_m');
  if (!['typed', 'typical', 'library'].includes(r.height_source ?? '')) out.push('height_source');
  if (!r.pipeline || typeof r.pipeline.model !== 'string' || typeof r.pipeline.seed !== 'number') out.push('pipeline');
  if (!r.credit || typeof r.credit.line !== 'string' || !r.credit.line) out.push('credit');
  else if (r.source === 'library' && (!r.credit.author || !r.credit.licence)) out.push('credit author and licence');
  return out;
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const PIPELINE = { name: 'photo_to_object', model: 'SAM 3 + SAM 3D Objects', seed: 42, texture: 1024 } as const;
