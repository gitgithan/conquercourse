// Shared pieces in Community (CC-247; wallpapers stay in the maker's browser, CC-249): what a share may contain, checked by the page and again by the server.
// Pure code, no network, so the rules are tested without a browser (tests/community-items.test.ts).
export type ItemKind = 'piece';
export interface ItemMeta { height_m?: number; course?: string; credit?: string }
export interface CleanItem { kind: ItemKind; name: string; thumb: string; glb: string; meta: ItemMeta }
export interface PublicItem { id: string; kind: ItemKind; name: string; at: number; meta: ItemMeta; thumb?: string; mine?: boolean; status?: string }

export const MAX_THUMB_CHARS = 160_000; // a 640 px JPEG is about 40 KB
export const MAX_GLB_CHARS = 1_400_000; // base64 of about 1 MB; a finished piece is 300 to 500 KB
export const GLB_MAGIC = 'Z2xUR'; // "glTF" in base64 (the fifth letter depends on the next byte, so only the first five are compared)
const NAME_RE = /^[a-z0-9][a-z0-9 '\-]{1,38}[a-z0-9]$/i;

export const cleanName = (v: unknown): string => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

/** What a share may contain, or the reason (plain words) it is refused. */
export function cleanItem(b: Record<string, unknown>): { ok: true; item: CleanItem } | { ok: false; error: string } {
  const kind = b.kind === 'piece' ? b.kind : null;
  if (!kind) return { ok: false, error: 'Only 3D pieces can be shared.' };
  const name = cleanName(b.name);
  if (!NAME_RE.test(name)) return { ok: false, error: 'Give it a name of 3 to 40 letters or numbers.' };
  const thumb = String(b.thumb ?? '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(thumb) || thumb.length > MAX_THUMB_CHARS) return { ok: false, error: 'The small picture must be a JPEG under 120 KB.' };
  const meta: ItemMeta = {};
  let glb = '';
  glb = String(b.glb ?? '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(glb) || glb.length > MAX_GLB_CHARS || !glb.startsWith(GLB_MAGIC)) return { ok: false, error: 'The 3D file is not a valid .glb under 1 MB.' };
  const h = Number(b.height_m);
  if (!(h >= 0.05 && h <= 10)) return { ok: false, error: 'The piece needs a height between 5 cm and 10 m.' };
  meta.height_m = Math.round(h * 100) / 100;
  meta.credit = 'Made by a player from their own photo';
  return { ok: true, item: { kind, name, thumb, glb, meta } };
}

export const SESSION_RE = /^[a-zA-Z0-9-]{8,64}$/;

/** What the safety check's answer means for a share: shown to everyone, held for a person to look at, or refused. */
export function visibilityFor(verdict: string, reason: string): 'approved' | 'pending' | 'refused' {
  if (verdict === 'block') return 'refused';
  if (verdict === 'ok' && reason === 'none') return 'approved';
  return 'pending';
}
