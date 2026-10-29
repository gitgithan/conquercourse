// Map mode, part 2 (CC-78): how a dropped pin becomes a place you can see.
//   - "Ready places": built once, shipped as files, load at once; a pin within 300 m of one snaps to it.
//   - Steps with times and a Cancel button; a plain error that offers the nearest ready places.
//   - The explain strip: what was found, how it was shrunk, which lane the simulator cleared, and on the map which footprints became which obstacle.
// map.ts calls `installPlaces`; the pure parts are in src/world/places.ts and src/world/place-lane.ts.
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { askMirrors, hasPath, nearestReady, shownReady, placeKey, type PlaceLane, type ReadyIndexEntry, type ReadyPlace } from '../world/places';
import { buildingsFrom, type OverpassAnswer } from '../world/osm';
import { relief, type Ground } from '../world/terrain';
import { toLonLat } from '../slice/slicer';
import type { PlaceLaneAnswer, PlaceLaneAsk } from '../world/place-lane-worker';

export interface PlaceCtx {
  map: MapLibreMap; side: HTMLElement;
  tell(s: string, bad?: boolean): void;
  pin(): { lat: number; lon: number } | null;
  radius(): number; hills(): boolean;
  /** CC-211: only places with a proven path are listed, snapped to or opened in the editor. ?slice2=old turns it off. */
  strict?: boolean;
  setPin(lat: number, lon: number): void; setRadius(r: number): void;
  groundFor(lat: number, lon: number, r: number): Promise<Ground | null>;
}
export interface Obtained { answer: OverpassAnswer; lat: number; lon: number; radius: number; ground: Ground | null; source: 'ready' | 'site' | 'browser'; ms: number; lane: PlaceLane | null; name: string }

export class PlaceError extends Error { constructor(message: string, readonly nearest: ReadyIndexEntry[] = []) { super(message); } }

const ROLE_COLOR = { deck: '#4f9d80', step: '#f0b400', wall: '#d9534f', 'gap-edge': '#7b5ea7', unused: '#b4beb7' } as const;
const ROLE_WORDS = { deck: 'flat run', step: 'step', wall: 'wall to climb', 'gap-edge': 'edge of a gap', unused: 'not used' } as const;

const linked = (a: AbortSignal, ms: number): AbortSignal => { // aborts when `a` does, or after `ms`
  const c = new AbortController(); const stop = () => c.abort();
  if (a.aborted) c.abort(); else a.addEventListener('abort', stop, { once: true });
  setTimeout(stop, ms);
  return c.signal;
};

const STEPS = [
  ['ask', 'Asking the map for buildings'],
  ['ground', 'Reading the height of the ground'],
  ['mesh', 'Building the place'],
  ['lane', 'Finding a lane the simulator can clear'],
] as const;
type StepId = (typeof STEPS)[number][0];

export function installPlaces(ctx: PlaceCtx) {
  const { map, side } = ctx;
  const style = document.createElement('style');
  style.textContent = `
    .mp .ready summary{cursor:pointer;font-size:13px;color:#2d3a34;font-weight:600}.mp .ready-list{display:grid;gap:3px;margin-top:4px}.mp .ready button{text-align:left;font-size:13px;padding:3px 8px}.mp .ready small{color:#58635d}
    .mp .gal{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;max-height:340px;overflow:auto}.mp .gal button.card{display:grid;gap:2px;padding:0;overflow:hidden;border:2px solid #b9c2bb;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.mp .gal button.card[aria-pressed=true]{border-color:#2f7d5b;box-shadow:0 0 0 2px #bfe3cf}
    .mp .gal .ph{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#e8eee9}.mp .gal .nm{font-size:13px;font-weight:700;padding:0 6px;line-height:1.2}.mp .gal .ct{font-size:12px;color:#58635d;padding:0 6px}.mp .gal .bd{display:flex;gap:4px;align-items:center;padding:0 6px 4px;font-size:11px;color:#58635d}.mp .gal .rd{background:#2f7d5b;color:#fff;border-radius:8px;padding:0 6px}.mp .gal .cr{font-size:10px;color:#6d7872;padding:0 6px 4px}
    .mp .steps{border:1px solid #b9c2bb;border-radius:8px;background:#fff;padding:6px 8px;display:grid;gap:3px;font-size:13px}.mp .steps ol{margin:0;padding:0;list-style:none;display:grid;gap:2px}
    .mp .steps li{display:grid;grid-template-columns:18px 1fr auto;gap:4px}.mp .steps li[data-s=todo]{color:#8a948e}.mp .steps li[data-s=doing]{font-weight:700}.mp .steps li[data-s=failed]{color:#c0392b}
    .mp .explain{border:1px solid #b9c2bb;border-radius:8px;background:#fff;padding:6px 8px;display:grid;gap:4px;font-size:13px}.mp .explain ul{margin:0;padding-left:16px;display:grid;gap:2px}
    .mp .legend{display:flex;flex-wrap:wrap;gap:3px 10px}.mp .legend i{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:4px;vertical-align:-1px}
    .mp .offer{display:grid;gap:3px}`;
  document.head.appendChild(style);
  const dset = (k: string, v: string | number) => { document.documentElement.dataset[k] = String(v); };

  // ---- the pieces of the side panel
  const readyEl = document.createElement('details'); readyEl.className = 'ready'; readyEl.id = 'ready';
  const stepsEl = document.createElement('div'); stepsEl.className = 'steps'; stepsEl.id = 'steps'; stepsEl.hidden = true;
  stepsEl.innerHTML = `<ol>${STEPS.map(([id, text]) => `<li data-id="${id}" data-s="todo"><span class="ic">·</span><span class="tx">${text}</span><span class="tm"></span></li>`).join('')}</ol><button type="button" id="cancelbuild">Cancel</button>`;
  const errEl = document.createElement('div'); errEl.className = 'offer'; errEl.id = 'offer'; errEl.hidden = true;
  const openBtn = document.createElement('button'); openBtn.type = 'button'; openBtn.id = 'openeditor'; openBtn.className = 'go'; openBtn.textContent = 'Open in the editor'; openBtn.hidden = true;
  const explainEl = document.createElement('div'); explainEl.className = 'explain'; explainEl.id = 'explain'; explainEl.hidden = true;
  const buildBtn = side.querySelector('#build') as HTMLElement;
  buildBtn.after(stepsEl, errEl, openBtn, explainEl);
  (side.querySelector('#hits') as HTMLElement).after(readyEl);
  openBtn.onclick = () => { location.search = '?mode=editor'; };

  // ---- ready places
  let index: ReadyIndexEntry[] = [];
  const loadIndex = (async () => {
    try { index = (await (await fetch('/assets/places/index.json')).json()) as ReadyIndexEntry[]; } catch { index = []; }
    if (!index.length) return;
    const qs = new URLSearchParams(location.search), strict = ctx.strict === true;
    const showAll = qs.get('places') === 'all' && (!strict || qs.get('debug') === 'places'), shown = shownReady(index, showAll, strict); // CC-211: the no-path cards need ?places=all&debug=places
    const gallery = new URLSearchParams(location.search).get('slice2') !== 'old';
    let thumbs: Record<string, { author: string; licence: string; source: string }> = {};
    if (gallery) { try { thumbs = await (await fetch('/assets/places/thumbs/index.json')).json(); } catch { thumbs = {}; } }
    const pick = (p: ReadyIndexEntry) => { map.flyTo({ center: [p.lon, p.lat], zoom: 16, duration: 700 }); ctx.setRadius(p.radius); ctx.setPin(p.lat, p.lon); ctx.tell(`${p.name}: ready. Press Build.`); };
    const head = document.createElement('summary'); head.textContent = `Ready places (${shown.length}, they load at once)`;
    const list = document.createElement('div'); list.className = gallery ? 'ready-list gal' : 'ready-list';
    list.replaceChildren(...shown.map((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.slug = p.slug;
      if (!gallery) {
        b.innerHTML = `${p.name} <small>${p.hill_m >= 3 ? `hill ${p.hill_m} m` : 'flat'}${showAll && p.listed === false ? ', no photos or no lane' : ''}</small>`;
        b.onclick = () => pick(p);
        return b;
      }
      const cut = p.name.lastIndexOf(','), nm = cut > 0 ? p.name.slice(0, cut) : p.name, city = cut > 0 ? p.name.slice(cut + 1).trim() : '';
      const th = thumbs[p.slug], img = document.createElement('img');
      img.className = 'ph'; img.loading = 'lazy'; img.alt = ''; img.src = th ? `/assets/places/thumbs/${p.slug}.jpg` : `/assets/places/tiles/${p.slug}.svg`; img.dataset.kind = th ? 'photo' : 'tile';
      const ready = p.listed !== false;
      b.className = 'card'; b.setAttribute('aria-pressed', 'false');
      if (th) b.title = `Photo: ${th.author}, ${th.licence}`;
      b.append(img);
      b.insertAdjacentHTML('beforeend', `<span class="nm"></span><span class="ct"></span><span class="bd"><span class="rd">${ready ? 'ready' : 'no photos or no lane'}</span>${p.hill_m >= 3 ? `hill ${p.hill_m} m` : 'flat'}</span>${th ? `<span class="cr">Photo: ${th.author.replace(/<[^>]*>/g, '')}, ${th.licence}</span>` : ''}`);
      (b.querySelector('.nm') as HTMLElement).textContent = nm; (b.querySelector('.ct') as HTMLElement).textContent = city;
      b.onclick = () => { list.querySelectorAll('button.card').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pick(p); };
      return b;
    }));
    readyEl.replaceChildren(head, list);
    if (gallery) readyEl.open = true;
    dset('readyPlaces', shown.length); dset('readyPlacesAll', index.length);
  })();

  // ---- steps
  const li = (id: StepId) => stepsEl.querySelector(`li[data-id="${id}"]`) as HTMLElement;
  const started: Partial<Record<StepId, number>> = {};
  let ticker = 0, current: AbortController | null = null;
  function setStep(id: StepId, s: 'todo' | 'doing' | 'done' | 'failed' | 'skipped', note?: string) {
    const el = li(id); el.dataset.s = s;
    (el.querySelector('.ic') as HTMLElement).textContent = s === 'done' ? '✓' : s === 'failed' ? '✗' : s === 'doing' ? '…' : s === 'skipped' ? '–' : '·';
    if (s === 'doing') started[id] = Date.now();
    if (note) (el.querySelector('.tx') as HTMLElement).textContent = note;
    if (s !== 'doing') { const t = started[id]; (el.querySelector('.tm') as HTMLElement).textContent = t ? `${((Date.now() - t) / 1000).toFixed(1)} s` : ''; }
    dset('step' + id[0].toUpperCase() + id.slice(1), s);
  }
  function startSteps() {
    stepsEl.hidden = false; errEl.hidden = true; openBtn.hidden = true; explainEl.hidden = true;
    for (const [id, text] of STEPS) { setStep(id, 'todo', text); (li(id).querySelector('.tm') as HTMLElement).textContent = ''; delete started[id]; }
    clearInterval(ticker);
    ticker = window.setInterval(() => { for (const [id] of STEPS) if (li(id).dataset.s === 'doing') (li(id).querySelector('.tm') as HTMLElement).textContent = `${((Date.now() - (started[id] ?? Date.now())) / 1000).toFixed(0)} s`; }, 500);
  }
  const stopTicker = () => clearInterval(ticker);
  (stepsEl.querySelector('#cancelbuild') as HTMLButtonElement).onclick = () => current?.abort();

  // ---- the answer: a ready place, the site's own cache, or the map servers straight from the browser
  async function loadReady(slug: string, signal: AbortSignal): Promise<ReadyPlace> {
    const res = await fetch(`/assets/places/${slug}.json`, { signal });
    if (!res.ok) throw new PlaceError('That ready place could not be loaded.');
    return (await res.json()) as ReadyPlace;
  }
  async function ask(lat: number, lon: number, radius: number, signal: AbortSignal, direct: () => void = () => {}): Promise<{ answer: OverpassAnswer; source: 'site' | 'browser'; ms: number }> {
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/places?lat=${lat}&lon=${lon}&r=${radius}`, { signal: linked(signal, 35000) });
      if (res.ok) { const j = (await res.json()) as { elements: OverpassAnswer['elements']; source?: string; cache?: string }; dset('placeSource', 'site'); dset('placeCache', j.cache ?? ''); dset('placeMirror', j.source ?? ''); return { answer: { elements: j.elements }, source: 'site', ms: Date.now() - t0 }; }
      if (res.status === 400) throw new PlaceError(((await res.json()) as { error?: string }).error ?? 'That place cannot be built.');
    } catch (e) { if (signal.aborted || e instanceof PlaceError) throw e; /* no function here, or slow: try the servers directly */ }
    direct();
    const got = await askMirrors({ lat, lon, radius }, { userAgent: false, timeoutMs: 20000, signal });
    dset('placeSource', 'browser'); dset('placeMirror', got.mirror);
    return { answer: got.answer, source: 'browser', ms: Date.now() - t0 };
  }


  // CC-211: with the new screen there is no box: a ready place with a path is always used when one is near (?useready=0 turns it off for debugging)
  const proven = (): ReadyIndexEntry[] => (ctx.strict ? index.filter(hasPath) : index);
  const useReady = (): boolean => (ctx.strict ? new URLSearchParams(location.search).get('useready') !== '0' : (document.getElementById('useready') as HTMLInputElement | null)?.checked !== false);
  const readyNear = (lat: number, lon: number) => (useReady() ? nearestReady(proven(), lat, lon, 300) : null);

  // ---- CC-152: speed. Switch off with ?speed=0.
  // The wait is the map servers (about 20 to 40 s for a new pin), so it starts the moment the pin is dropped, not when Build is pressed,
  // and the ground heights are asked in the same breath instead of after the buildings. Build then joins the request that is already running.
  const speedOn = new URLSearchParams(location.search).get('speed') !== '0';
  interface Fetched { answer: Promise<{ answer: OverpassAnswer; source: 'site' | 'browser'; ms: number }>; ground: Promise<Ground | null>; hills: boolean; startedAt: number }
  const fetched = new Map<string, Fetched>();
  let prefetchTimer = 0;
  const fetchKey = (lat: number, lon: number, radius: number) => placeKey({ lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, radius: Math.round(radius / 10) * 10 });
  function startFetch(lat: number, lon: number, radius: number, signal: AbortSignal, direct: () => void = () => {}): Fetched {
    const hills = ctx.hills();
    const answer = ask(lat, lon, radius, signal, direct);
    const ground = hills ? ctx.groundFor(lat, lon, radius).catch(() => null) : Promise.resolve(null);
    answer.catch(() => {}); // a speculative request that fails is not an error until Build joins it
    return { answer, ground, hills, startedAt: Date.now() };
  }
  // Called by map.ts when a pin is dropped or the radius slider is let go: waits a moment (a player clicking around does not fire every click).
  function prefetch() {
    clearTimeout(prefetchTimer);
    const p = ctx.pin(); if (!speedOn || !p) return;
    prefetchTimer = window.setTimeout(() => {
      const radius = ctx.radius();
      if (readyNear(p.lat, p.lon)) return; // a ready place loads at once
      const key = fetchKey(p.lat, p.lon, radius);
      if (fetched.has(key)) return;
      if (fetched.size >= 4) fetched.delete(fetched.keys().next().value as string); // only the last few pins are kept
      const f = startFetch(p.lat, p.lon, radius, new AbortController().signal);
      fetched.set(key, f);
      f.answer.catch(() => { if (fetched.get(key) === f) fetched.delete(key); }); // a failed request is asked again on Build
      dset('prefetch', key);
    }, 700);
  }

  const nearestFew = (lat: number, lon: number) => {
    const mLat = 111320, mLon = 111320 * Math.cos((lat * Math.PI) / 180);
    return [...proven()].sort((a, b) => Math.hypot((a.lon - lon) * mLon, (a.lat - lat) * mLat) - Math.hypot((b.lon - lon) * mLon, (b.lat - lat) * mLat)).slice(0, 3);
  };
  // CC-211: a place the simulator could not cross is not offered: the plain reason and the nearest places that do have a path
  function refuse(lat: number, lon: number, why: string) {
    openBtn.hidden = true;
    showError(new PlaceError(why, nearestFew(lat, lon)));
    dset('noPath', '1');
  }
  function showError(e: PlaceError) {
    errEl.hidden = false; errEl.replaceChildren();
    const m = document.createElement('div'); m.className = 'say bad'; m.textContent = e.message; errEl.appendChild(m);
    if (e.nearest.length) {
      const t = document.createElement('div'); t.className = 'muted'; t.textContent = 'These ready places load at once:'; errEl.appendChild(t);
      for (const p of e.nearest) { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name; b.onclick = () => { errEl.hidden = true; map.flyTo({ center: [p.lon, p.lat], zoom: 16, duration: 600 }); ctx.setRadius(p.radius); ctx.setPin(p.lat, p.lon); (buildBtn as HTMLButtonElement).click(); }; errEl.appendChild(b); }
    }
  }

  async function obtain(): Promise<Obtained | null> {
    const p = ctx.pin(); if (!p) return null;
    await loadIndex;
    const ctl = new AbortController(); current = ctl;
    startSteps(); dset('placeSource', ''); const t0 = Date.now();
    try {
      let { lat, lon } = p, radius = ctx.radius();
      const snap = readyNear(lat, lon);
      if (snap) {
        setStep('ask', 'doing', `Loading the ready place: ${snap.name}`);
        const rp = await loadReady(snap.slug, ctl.signal);
        lat = rp.lat; lon = rp.lon; radius = rp.radius; ctx.setPin(lat, lon); ctx.setRadius(radius);
        setStep('ask', 'done', `Ready place: ${rp.name}`);
        const ground: Ground | null = ctx.hills() && rp.ground ? { radius, ...rp.ground } : null;
        setStep('ground', ground ? 'done' : 'skipped', ground ? `Height of the ground: ${Math.round(relief(ground))} m from lowest to highest` : 'Flat ground');
        dset('placeSource', 'ready'); dset('placeSlug', rp.slug);
        return { answer: rp.answer, lat, lon, radius, ground, source: 'ready', ms: Date.now() - t0, lane: rp.lane, name: rp.name };
      }
      setStep('ask', 'doing', 'Asking the map for buildings');
      const key = fetchKey(lat, lon, radius), early = speedOn ? fetched.get(key) : undefined;
      let f = early;
      if (f && f.hills !== ctx.hills()) f = { ...f, ground: ctx.hills() ? ctx.groundFor(lat, lon, radius).catch(() => null) : Promise.resolve(null), hills: ctx.hills() };
      if (!f) f = startFetch(lat, lon, radius, ctl.signal, () => setStep('ask', 'doing', 'Asking the map servers directly'));
      dset('prefetchUsed', early ? 'yes' : 'no');
      if (ctx.hills()) setStep('ground', 'doing');
      const cancelled = new Promise<never>((_, no) => ctl.signal.addEventListener('abort', () => no(new Error('cancelled')), { once: true }));
      const got = await Promise.race([f.answer, cancelled]);
      setStep('ask', 'done', `${buildingsFrom(got.answer, lat, lon).length} buildings found (${got.source === 'site' ? 'from the site' : 'from the map servers'})${early ? ', asked in advance' : ''}`);
      dset('askMs', Date.now() - (early ? early.startedAt : t0));
      let ground: Ground | null = null;
      if (ctx.hills()) {
        ground = await Promise.race([f.ground, cancelled]);
        setStep('ground', ground ? 'done' : 'failed', ground ? `Height of the ground: ${Math.round(relief(ground))} m from lowest to highest` : 'The height maps did not answer: the place is built flat');
      } else setStep('ground', 'skipped', 'Flat ground (hills are off)');
      dset('obtainMs', Date.now() - t0);
      return { answer: got.answer, lat, lon, radius, ground, source: got.source, ms: Date.now() - t0, lane: null, name: '' };
    } catch (e) {
      stopTicker();
      if (ctl.signal.aborted) { ctx.tell('Cancelled.'); for (const [id] of STEPS) if (li(id).dataset.s === 'doing') setStep(id, 'failed', 'Cancelled'); return null; }
      for (const [id] of STEPS) if (li(id).dataset.s === 'doing') setStep(id, 'failed');
      const nearest = nearestFew(p.lat, p.lon);
      showError(e instanceof PlaceError ? new PlaceError(e.message, e.nearest.length ? e.nearest : nearest) : new PlaceError('The map data servers did not answer. They are public and sometimes busy.', nearest));
      ctx.tell('Could not get the buildings. A ready place will work.', true);
      return null;
    }
  }

  // ---- after the mesh: the explain strip, the footprints painted by role, and the lane
  let laneWorker: Worker | null = null, laneToken = 0;
  async function ensureLayers() {
    if (map.getSource('pl-fp')) return;
    if (!map.isStyleLoaded()) await new Promise<void>((res) => map.once('idle', () => res()));
    const empty = { type: 'FeatureCollection' as const, features: [] as unknown[] };
    map.addSource('pl-fp', { type: 'geojson', data: empty as never });
    map.addSource('pl-lane', { type: 'geojson', data: empty as never });
    map.addLayer({ id: 'pl-fp-fill', type: 'fill', source: 'pl-fp', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'role'], 'unused'], 0.4, 0.88] } } as never);
    map.addLayer({ id: 'pl-fp-line', type: 'line', source: 'pl-fp', paint: { 'line-color': '#17201d', 'line-width': 0.8, 'line-opacity': 0.6 } } as never);
    map.addLayer({ id: 'pl-lane-line', type: 'line', source: 'pl-lane', paint: { 'line-color': '#0f6b5c', 'line-width': 5, 'line-dasharray': [1.2, 0.8] } } as never);
  }
  const col = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features });

  async function paint(o: Obtained, lane: PlaceLane | null) {
    await ensureLayers();
    const bs = buildingsFrom(o.answer, o.lat, o.lon), roleOf = new Map<number, keyof typeof ROLE_COLOR>();
    for (const r of lane?.roles ?? []) roleOf.set(r.footprint, r.role);
    const counts: Record<string, number> = { deck: 0, step: 0, wall: 0, 'gap-edge': 0, unused: 0 };
    const feats = bs.map((b, i) => {
      const role = roleOf.get(i) ?? 'unused'; counts[role]++;
      let ring = b.ring.slice(); if (ring.length < 3) return null;
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring = [...ring, ring[0]];
      return { type: 'Feature' as const, properties: { role, color: ROLE_COLOR[role] }, geometry: { type: 'Polygon' as const, coordinates: [ring.map(([x, z]) => toLonLat(o.lat, o.lon, x, z))] } };
    }).filter(Boolean);
    (map.getSource('pl-fp') as GeoJSONSource).setData(col(feats) as never);
    const line = lane && lane.cleared ? [toLonLat(o.lat, o.lon, lane.line[0], lane.line[1]), toLonLat(o.lat, o.lon, lane.line[2], lane.line[3])] : [];
    (map.getSource('pl-lane') as GeoJSONSource).setData(col(line.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }] : []) as never);
    dset('roleDeck', counts.deck); dset('roleStep', counts.step); dset('roleWall', counts.wall); dset('roleGapEdge', counts['gap-edge']); dset('roleUnused', counts.unused);
  }

  function render(o: Obtained, m: { buildings: number; withRealHeight: number; medianHeight: number; shrink: number; relief: number }, lane: PlaceLane | null, working: string) {
    const rel = relief(o.ground), k = lane?.cleared ? lane.shrink : m.shrink;
    const items = [
      `<b>${m.buildings}</b> buildings found${m.withRealHeight ? `, ${m.withRealHeight} with a height written on the map` : ', none with a height written (guessed 9 m)'}.`,
      o.ground ? `Ground: <b>${Math.round(rel)} m</b> from the lowest to the highest point (terrain tiles).` : 'Ground: flat.',
      `Shrunk to <b>${k}</b> of real size: a ${Math.round(m.medianHeight)} m building becomes ${(m.medianHeight * k).toFixed(1)} m, so a runner can step onto it.`,
    ];
    if (lane?.cleared) {
      items.push(`Lane cut at <b>${lane.levelM} m</b> above the lowest ground, turned ${lane.turnDeg}°.`);
      const parts = [`${lane.steps} step${lane.steps === 1 ? '' : 's'}`, `${lane.faces} wall${lane.faces === 1 ? '' : 's'}`, `${lane.gaps} gap${lane.gaps === 1 ? '' : 's'}`].join(', ');
      items.push(`Lane <b>${lane.lengthM} m</b> long: ${parts}; longest drop ${lane.maxDropM} m. The simulator cleared it${lane.secondsTaken ? ` (${lane.secondsTaken} s)` : ''}.`);
    } else if (lane && !lane.cleared) items.push('No lane the simulator could clear at these sizes. Try a smaller radius, or another place.');
    else items.push(working);
    explainEl.hidden = false; explainEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    explainEl.innerHTML = `<b>How the pin became a course</b><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>
      <div class="legend">${(Object.keys(ROLE_COLOR) as (keyof typeof ROLE_COLOR)[]).map((r) => `<span><i style="background:${ROLE_COLOR[r]}"></i>${ROLE_WORDS[r]}</span>`).join('')}</div>
      <div class="muted">Dashed green line: where the lane runs.</div>`;
  }

  // Called by map.ts when the mesh is built and stored: show the strip now, then fill in the lane (instantly for a ready place, in a worker otherwise).
  type MeshInfo = Parameters<typeof render>[1];
  function finish(o: Obtained, m0: MeshInfo, k0: number, remesh: (k: number) => MeshInfo, setLane: (l: PlaceLane | null) => void = () => {}) {
    let m = m0;
    stopTicker();
    setStep('mesh', 'done', `Built the place (${m.buildings} buildings)`);
    dset('noPath', '');
    openBtn.hidden = !!ctx.strict; // CC-211: shown only once a lane is proved
    const prove = (l: PlaceLane | null) => { if (!ctx.strict) return; if (l?.cleared) { openBtn.hidden = false; errEl.hidden = true; if (new URLSearchParams(location.search).get('auto') === '1') openBtn.click(); } else refuse(o.lat, o.lon, 'The simulator found no path on this place, so it is not offered. Try a smaller radius, or pick one of these places.'); };
    if (!ctx.strict && new URLSearchParams(location.search).get('auto') === '1') openBtn.click();
    if (o.lane) { prove(o.lane); setLane(o.lane); setStep('lane', o.lane.cleared ? 'done' : 'failed', o.lane.cleared ? `Lane found: ${o.lane.lengthM} m (precomputed)` : 'No lane found'); render(o, m, o.lane, ''); void paint(o, o.lane); dset('lanePhase', 'done'); return; }
    const laneKey = `cc.lane:${fetchKey(o.lat, o.lon, o.radius)}:${o.ground ? 'h' : 'f'}`;
    if (speedOn) { // a lane found once in this browser is kept: the same pin again is at once
      try {
        const kept = JSON.parse(localStorage.getItem(laneKey) ?? 'null') as PlaceLane | null;
        if (kept?.cleared) { prove(kept); setLane(kept); setStep('lane', 'done', `Lane found: ${kept.lengthM} m (kept from last time)`); render(o, m, kept, ''); void paint(o, kept); dset('lanePhase', 'done'); dset('laneKept', 'yes'); return; }
      } catch { /* no kept lane */ }
    }
    render(o, m, null, 'Looking for a lane the simulator can clear (this runs in the background)...');
    void paint(o, null);
    setStep('lane', 'doing', 'Finding a lane the simulator can clear (in the background)'); dset('lanePhase', 'working');
    ticker = window.setInterval(() => { (li('lane').querySelector('.tm') as HTMLElement).textContent = `${((Date.now() - (started.lane ?? Date.now())) / 1000).toFixed(0)} s`; }, 1000);
    const my = ++laneToken; laneWorker?.terminate();
    try { laneWorker = new Worker(new URL('../world/place-lane-worker.ts', import.meta.url), { type: 'module' }); } catch { setStep('lane', 'failed', 'This browser cannot search in the background'); prove(null); return; }
    laneWorker.onmessage = (e: MessageEvent<PlaceLaneAnswer>) => {
      const a = e.data; if (a.id !== my) return;
      if (a.phase === 'step') { (li('lane').querySelector('.tx') as HTMLElement).textContent = a.message; return; }
      stopTicker(); laneWorker?.terminate(); laneWorker = null;
      setStep('lane', a.lane?.cleared ? 'done' : 'failed', a.lane?.cleared ? `Lane found: ${a.lane.lengthM} m` : 'No lane found');
      if (a.lane?.cleared && a.lane.shrink !== k0) m = remesh(a.lane.shrink); // the editor gets the place at the size the lane was cut from
      prove(a.lane); setLane(a.lane);
      if (speedOn && a.lane?.cleared) try { localStorage.setItem(laneKey, JSON.stringify(a.lane)); } catch { /* storage full or off */ }
      render(o, m, a.lane, ''); void paint(o, a.lane); dset('lanePhase', 'done'); dset('laneLength', a.lane?.lengthM ?? 0);
    };
    laneWorker.postMessage({ id: my, answer: o.answer, lat: o.lat, lon: o.lon, ground: o.ground, ladder: Array.from({ length: 5 }, (_, i) => Math.round(k0 * 0.6 ** i * 1000) / 1000) } satisfies PlaceLaneAsk);
  }

  // `snap` is called by map.ts when a pin is dropped: tell the player when a ready place is near
  function snapNote(lat: number, lon: number): string {
    const s = readyNear(lat, lon);
    return s ? ` ${s.name} is ready here: Build loads it at once.` : '';
  }
  return { obtain, finish, setStep, snapNote, prefetch, ready: loadIndex };
}
