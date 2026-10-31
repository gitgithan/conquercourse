// The "Street photos" panel of the World Slicer (CC-90): thumbnails along the lane, with distance, a click to enlarge and the CC BY-SA credit.
// Reads only the per-place allow-list (photos checked for people ahead of time); the picture addresses come from our own /api/photos, never a token in the page.
import { mountPlacePhotos, type PhotosHandle, type PlacePhotos } from './place-photos';
import { resolveThumbs } from './live-photos';
import { creditFor, type AllowList, type Thumb } from '../world/live-photos';
import { coverageLine, lanePhotos, MAX_THUMBS, spread } from '../world/street-photos';

export interface StreetPanel { update(slug: string | null, line: [number, number, number, number] | null): void; destroy(): void }

export function mountStreetPanel(host: HTMLElement, f: typeof fetch = fetch): StreetPanel {
  const root = document.createElement('div'); root.id = 'streetpanel'; root.className = 'say';
  root.innerHTML = '<b>Street photos</b> <span id="streetline"></span><div id="streetthumbs"></div>';
  host.append(root);
  const lineEl = root.querySelector('#streetline') as HTMLElement, thumbsEl = root.querySelector('#streetthumbs') as HTMLElement;
  const lists = new Map<string, Promise<AllowList | null>>(), places = new Map<string, Promise<{ lat: number; lon: number } | null>>(), got = new Map<string, Thumb>();
  const getJson = <T,>(url: string): Promise<T | null> => f(url).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);
  let handle: PhotosHandle | null = null, token = 0, timer = 0;
  const set = (key: string, v: string) => { root.dataset[key] = v; };
  async function run(slug: string | null, line: [number, number, number, number] | null) {
    const mine = ++token; handle?.destroy(); handle = null; thumbsEl.replaceChildren();
    if (!slug) { lineEl.textContent = coverageLine(null, false); set('coverage', 'no-list'); return; }
    if (!lists.has(slug)) { lists.set(slug, getJson<AllowList>(`/assets/photos-live/${slug}.json`)); places.set(slug, getJson<{ lat: number; lon: number }>(`/assets/places/${slug}.json`)); }
    const [allow, pl] = await Promise.all([lists.get(slug)!, places.get(slug)!]);
    if (mine !== token) return;
    if (!allow?.photos?.length || !pl) { lineEl.textContent = coverageLine(null, false); set('coverage', 'no-list'); return; }
    const view = line ? lanePhotos(allow.photos, pl, line) : null;
    lineEl.textContent = coverageLine(view, true); set('coverage', view?.coverage ?? 'none'); set('count', String(view?.photos.length ?? 0));
    if (!view || !view.photos.length) return;
    const chosen = spread(view.photos, MAX_THUMBS), need = chosen.filter((c) => !got.has(c.photo.id)).map((c) => c.photo.id);
    for (let i = 0; i < need.length; i += 3) { // the photo service takes three at a time
      const t = await resolveThumbs(need.slice(i, i + 3), f); if (mine !== token) return;
      if (!t) { lineEl.textContent += ' The picture service is not answering right now, so the pictures are not shown.'; set('thumbs', 'failed'); return; }
      for (const x of t) got.set(x.id, x);
    }
    const ready = chosen.filter((c) => got.has(c.photo.id));
    const d: PlacePhotos = { place: allow.place, name: allow.name, note: 'Street photos from Mapillary contributors, CC BY-SA 4.0. Click one to see it large.',
      photos: ready.map((c) => ({ ...creditFor(c.photo, got.get(c.photo.id)!, c.offM), hint: `${Math.round(c.alongM)} m along your lane, taken about ${Math.max(1, Math.round(c.offM))} m from the line.` })) };
    handle = mountPlacePhotos(thumbsEl, d, { floating: false }); set('thumbs', String(ready.length));
  }
  return { update(slug, line) { clearTimeout(timer); timer = window.setTimeout(() => void run(slug, line), 250); }, destroy() { token++; clearTimeout(timer); handle?.destroy(); root.remove(); } };
}
