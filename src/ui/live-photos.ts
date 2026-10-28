// The photo strip of a real-place course follows the runner (CC-90): street photos from the per-place allow-list change as the runner moves.
// The stored CC-85 strip is what shows first and whenever there is no live photo (no allow-list, nothing nearby, offline, or the photo service fails).
import { loadPlacePhotos, mountPlacePhotos, slugOfCourse, type PhotosHandle, type PlacePhotos } from './place-photos';
import { createLive, type AllowList, type PlaceLine, type Thumb } from '../world/live-photos';

const getJson = async <T>(url: string, f: typeof fetch): Promise<T | null> => {
  try { const r = await f(url); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
};

// The address of fresh pictures for allowed photo ids, from our own /api/photos (the token never reaches the page).
export async function resolveThumbs(ids: string[], f: typeof fetch = fetch): Promise<Thumb[] | null> {
  const r = await getJson<{ photos?: { id: string; thumb: string; creator: string; capturedAt: number | null }[] }>(`/api/photos?id=${ids.join(',')}`, f);
  return r?.photos?.length ? r.photos.map(({ id, thumb, creator, capturedAt }) => ({ id, thumb, creator, capturedAt })) : null;
}

export interface LiveStrip { update(x: number): void; destroy(): void }

export async function mountLivePhotos(host: HTMLElement, course: { name: string; startX: number; finishX: number }, f: typeof fetch = fetch): Promise<LiveStrip | null> {
  const slug = slugOfCourse(course.name);
  if (!slug) return null;
  const [stored, place, allow] = await Promise.all([loadPlacePhotos(slug, f), getJson<PlaceLine>(`/assets/places/${slug}.json`, f), getJson<AllowList>(`/assets/photos-live/${slug}.json`, f)]);
  let handle: PhotosHandle | null = null, shown: PlacePhotos | null = null;
  const paint = (d: PlacePhotos | null) => {
    if (d === shown || document.getElementById('placephotos-view')) return; // the large view is open: the strip waits
    handle?.destroy(); shown = d;
    handle = d ? mountPlacePhotos(host, d) : null;
  };
  paint(stored);
  if (!place?.lane?.line || !allow?.photos?.length) return { update() {}, destroy: () => handle?.destroy() };
  const live = createLive({ place, allow, course, resolve: (ids) => resolveThumbs(ids, f), show: (d) => paint(d ?? stored) });
  return { update: (x) => void live.update(x), destroy: () => handle?.destroy() };
}
