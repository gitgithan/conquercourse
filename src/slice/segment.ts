// Suggested things to pick on a photo (CC-248): the request checks and the reply, shared by the page, the server route and the tests.
import { MAX_PHOTO_CHARS } from './object-lift';

export interface Suggestion { label: string; score: number; box: [number, number, number, number]; cutout: string } // cutout: a small PNG (base64) that is white where the thing is

/** A plain reason the photo is refused, or '' when it can go on. */
export function segmentProblem(b: Record<string, unknown>): string {
  const img = b.image, thumb = b.thumb;
  if (typeof img !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img)) return 'Use a JPEG photo.';
  if (img.length > MAX_PHOTO_CHARS) return 'The photo is too big. Pick a smaller one.';
  if (typeof thumb !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(thumb) || thumb.length > 600_000) return 'The small copy of the photo is missing.';
  return '';
}

/** Keeps only well-formed suggestions inside the photo, at most 12, so a odd reply cannot break the page. */
export function cleanSuggestions(raw: unknown, width: number, height: number): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: Suggestion[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const b = r?.box as number[] | undefined;
    if (!Array.isArray(b) || b.length !== 4 || !b.every((v) => Number.isFinite(v))) continue;
    const [x0, y0, x1, y1] = b;
    if (!(x0 >= 0 && y0 >= 0 && x1 <= width && y1 <= height && x1 > x0 && y1 > y0)) continue;
    if (typeof r.label !== 'string' || !/^[a-z][a-z \-]{1,29}$/.test(r.label)) continue;
    out.push({ label: r.label, score: Number(r.score) || 0, box: [x0, y0, x1, y1], cutout: typeof r.cutout === 'string' && /^[A-Za-z0-9+/=]{0,40000}$/.test(r.cutout) ? r.cutout : '' });
    if (out.length >= 12) break;
  }
  return out;
}
