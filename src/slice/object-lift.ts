// Player photo -> 3D object (CC-221): the checks and the plain words, shared by the page and the server (functions/api/object-lift.ts).
// Pure, no network. The server and the Modal job repeat the same limits (pipelines/ccpipe/upload.py) because nothing from a browser is trusted.
export const MAX_PHOTO_CHARS = 1_400_000; // a 1280 px jpeg as base64 is about 0.5 to 1 MB
export const MAX_SIDE = 2400;
export const MIN_BOX = 24;
export const LABEL_RE = /^[a-z][a-z \-]{1,29}$/;

export interface LiftRequest { image: string; thumb: string; label: string; box: [number, number, number, number]; width: number; height: number; height_m: number | null; padretry: boolean }

/** A short plain reason the request is refused, or '' when it is fine. */
export function requestProblem(b: Record<string, unknown>): string {
  const img = b.image, thumb = b.thumb;
  if (typeof img !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img)) return 'Use a JPEG photo.';
  if (img.length > MAX_PHOTO_CHARS) return 'The photo is too big. Pick a smaller one.';
  if (typeof thumb !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(thumb) || thumb.length > 600_000) return 'The small copy of the photo is missing.';
  const label = String(b.label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!LABEL_RE.test(label)) return 'Say what it is in a few letters, for example: bench.';
  const w = Number(b.width), h = Number(b.height);
  if (!(w >= 200 && h >= 200 && w <= MAX_SIDE && h <= MAX_SIDE)) return 'The photo size is not allowed.';
  const box = b.box as unknown;
  if (!Array.isArray(box) || box.length !== 4 || !box.every((v) => typeof v === 'number' && Number.isFinite(v))) return 'Draw a box round the object.';
  const [x0, y0, x1, y1] = box as number[];
  if (!(x0 >= 0 && y0 >= 0 && x1 <= w && y1 <= h && x1 - x0 >= MIN_BOX && y1 - y0 >= MIN_BOX)) return 'The box must sit inside the photo and not be tiny.';
  if (b.height_m != null && b.height_m !== '') {
    const hm = Number(b.height_m);
    if (!(hm >= 0.1 && hm <= 6)) return 'The height must be between 0.1 and 6 metres.';
  }
  return '';
}

export function cleanRequest(b: Record<string, unknown>): LiftRequest {
  return {
    image: String(b.image), thumb: String(b.thumb), label: String(b.label).trim().toLowerCase().replace(/\s+/g, ' '),
    box: (b.box as number[]).map(Math.round) as LiftRequest['box'], width: Number(b.width), height: Number(b.height),
    height_m: b.height_m == null || b.height_m === '' ? null : Number(b.height_m), padretry: b.padretry !== false,
  };
}

/** What a moderation answer means for the lift. People are fine (the pipeline blurs them); real worries stop it. */
export function moderationStops(verdict: string, reason: string): string {
  if (verdict === 'review' && ['error', 'unreadable'].includes(reason)) return 'The safety check could not run just now, so nothing was made. Try again in a few minutes.';
  if (verdict === 'block') return 'This photo cannot be used here.';
  if (verdict === 'review' && reason === 'minor') return 'A child looks close up or large in this photo, so we cannot use it. Try a photo where people are small and far away, or where nobody is in the picture.';
  if (verdict === 'review' && reason === 'private_info') return 'Something private may be readable in this photo, like a number plate, an address, a document or a screen. Try a photo without readable writing.';
  if (verdict === 'review' && ['sexual', 'violence', 'hate', 'weapon'].includes(reason)) return 'This photo may show something that is not allowed here. Try a different photo of a place or an object.';
  return '';
}

/** Plain words for a finished job that is not a clean success. */
export function retryNote(retry: { note?: string } | undefined): string {
  if (retry?.note === 'pad') return 'The object touched the edge of the photo, so we added room around it and tried again.';
  if (retry?.note === 'still') return 'The object touches the edge of the photo and the shape may be cut off. A photo with room all round it works better.';
  return '';
}

export const FAIL_WORDS: Record<string, string> = {
  'not allowed': 'The 3D service is not switched on here.',
  'bad photo': 'We could not read that photo. Try a JPEG.',
  busy: 'The 3D service is busy. Try again in a minute.',
  down: 'The 3D service is not answering. Try again soon.',
  empty: 'We could not find an object inside that box. Draw the box tighter round it.',
};
export const failWords = (k: string): string => FAIL_WORDS[k] ?? 'Something went wrong while making the object. Try again, or draw the box a little differently.';
