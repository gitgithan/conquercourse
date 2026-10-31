// Wallpapers (CC-249, first small piece): a crop of the person's photo, kept in this browser, shown behind a Course when the address says `?wallpaper=<id>`.
// Looks only: it never changes how a course is cleared.
import * as THREE from 'three';

export interface Wallpaper { id: string; name: string; thumb: string; at: number; course?: string } // thumb: a small JPEG data address
const KEY = 'cc.wallpapers';
export const savedWallpapers = (): Wallpaper[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Wallpaper[]; } catch { return []; } };
export const saveWallpaper = (w: Wallpaper): boolean => { try { localStorage.setItem(KEY, JSON.stringify([w, ...savedWallpapers().filter((x) => x.id !== w.id)].slice(0, 12))); return true; } catch { return false; } };
export const deleteWallpaper = (id: string): void => { try { localStorage.setItem(KEY, JSON.stringify(savedWallpapers().filter((w) => w.id !== id))); } catch { /* nothing kept */ } };
/** Premade examples: the sample place photos, as `sample:park01`. They are real assets with rows in docs/ASSETS.md. */
export const SAMPLE_WALLPAPERS = ['park01', 'park02', 'park03', 'park06'];
export const wallpaperById = (id: string | null): Wallpaper | undefined => {
  const m = /^sample:(park\d\d)$/.exec(id ?? '');
  if (m && SAMPLE_WALLPAPERS.includes(m[1])) return { id: id!, name: `Sample place ${m[1].slice(4)}`, thumb: `/assets/park/${m[1]}.jpg`, at: 0 };
  return id && /^w[0-9a-z]{3,20}$/.test(id) ? savedWallpapers().find((w) => w.id === id) : undefined;
};

/** Cuts the box out of the photo (photo pixels) and returns a JPEG data address no wider than 640 px. */
export async function cropToThumb(photo: string, box: [number, number, number, number]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('The photo would not open.')); i.src = photo; });
  const w = box[2] - box[0], h = box[3] - box[1], k = Math.min(1, 640 / w);
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) });
  c.getContext('2d')!.drawImage(img, box[0], box[1], w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

/** `?wallpaper=<id>`: the saved crop becomes the scene backdrop. A missing or unknown id leaves the sky as it was. */
export function applyWallpaper(scene: THREE.Scene, params: URLSearchParams): void {
  const w = wallpaperById(params.get('wallpaper')); if (!w) return;
  new THREE.TextureLoader().load(w.thumb, (t) => { t.colorSpace = THREE.SRGBColorSpace; scene.background = t; });
}
