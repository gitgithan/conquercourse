// ?mode=map: pick a place on a real map, press "Build this place", and its buildings arrive in the world editor as one piece (CC-48).
// Map: MapLibre GL with OpenFreeMap tiles (no key). Search: Nominatim (no key, one call per search). Buildings: Overpass (no key).
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { buildingsFrom, extrude, osmToMesh, type OverpassAnswer } from '../world/osm';
import { installPlaces } from './map-place';
import type { PlaceLane } from '../world/places';
import { fetchGround, lowest, relief, TERRAIN_ATTRIBUTION, type Ground, type Tile } from '../world/terrain';
import { buildingTops, contourSegments, cutBuildings, cutRange, handoverLane, ladderLevels, ladderStep, laneLine, piecesFrom, resample, slopeCells, toLonLat, type MapPiece, type Seg } from '../slice/slicer';
import { reducedMotion, runFlight, scaleWords } from './map-flight';
import { loadPhotoIndex, loadPlacePhotos, mountPlacePhotos, nearestPlace, type PhotosHandle } from '../ui/place-photos';
import type { LaneSummary, SliceAnswer, SliceAsk, StripRow } from '../slice/slicer-worker';
import { whyNot } from '../slice/why';
import { explainNoPath, type Suggestion } from '../slice/suggest';
import { createPerf } from '../ui/perf';

export const PIECE_KEY = 'cc.map.piece';
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const PLACES = [
  { name: 'Eixample, Barcelona', lat: 41.3917, lon: 2.1649 },
  { name: 'Montmartre steps, Paris', lat: 48.8867, lon: 2.3431 },
  { name: 'Circular Quay, Sydney', lat: -33.861, lon: 151.2111 },
  { name: 'Shibuya Crossing, Tokyo', lat: 35.6595, lon: 139.7005 },
  { name: 'Central Park, New York', lat: 40.7829, lon: -73.9654 },
];

// A PNG tile to raw pixels in the browser
async function decodePng(png: ArrayBuffer): Promise<Tile> {
  const bmp = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bmp, 0, 0);
  return { data: g.getImageData(0, 0, bmp.width, bmp.height).data, width: bmp.width, channels: 4 };
}

export function startMap(host: HTMLElement): { backend: 'webgl2' } {
  maplibregl.setWorkerUrl(workerUrl); // Vite's dev server cannot find the worker by itself
  const q = new URLSearchParams(location.search);
  const OLD = q.get('slicewords') === 'old'; // CC-179: ?slicewords=old keeps the long text
  const W = (short: string, long: string) => (OLD ? long : short);
  const style = document.createElement('style');
  style.textContent = `
    .mp{font:14px/1.35 system-ui,sans-serif;color:#17201d;position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 280px}
    .mp .map{min-width:0;min-height:0}.mp .side{padding:10px;display:grid;gap:8px;align-content:start;background:#eef1ec;overflow:auto}
    .mp h1{margin:0;font-size:18px}.mp .muted{color:#58635d;font-size:12px}.mp label{display:grid;gap:1px;font-size:13px}.mp input[type=range]{width:100%;margin:0}
    .mp button,.mp input[type=search],.mp a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:4px 9px;cursor:pointer;text-decoration:none;box-sizing:border-box}
    .mp input[type=search]{width:100%;cursor:text}.mp .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.mp button:disabled{opacity:.5;cursor:default}
    .mp [hidden]{display:none!important}
    .mp .map{position:relative}.mp .fcap{position:absolute;left:10px;bottom:34px;max-width:70%;background:rgba(23,32,29,.86);color:#fff;padding:6px 10px;border-radius:8px;font-size:14px;z-index:6}
    .mp .fskip{position:absolute;left:10px;top:84px;z-index:6}
    .mp .legend{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:11px;color:#58635d}.mp .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;vertical-align:-1px}.mp .legend span{cursor:help}.mp .fix{display:grid;gap:3px;margin-top:4px}.mp .fix button{text-align:left}.mp details summary{cursor:pointer;font-size:12px;color:#58635d}
    .mp .hits{display:grid;gap:4px}.mp .hits button{text-align:left}.mp .say{border-left:4px solid #0f6b5c;padding:3px 6px;background:#f3f7f4;font-size:13px}.mp .say.bad{border-color:#c0392b;background:#fbeeee}
    @media(max-width:700px){.mp{grid-template-columns:minmax(0,1fr) 220px}}`;
  document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'mp'; host.appendChild(root);
  const mapEl = document.createElement('div'); mapEl.className = 'map'; mapEl.id = 'map'; root.appendChild(mapEl);
  const side = document.createElement('div'); side.className = 'side'; root.appendChild(side);
  side.innerHTML = `<h1>Pick a place</h1>
    <form id="searchform" class="hits"><input type="search" id="search" placeholder="Search for a place" aria-label="Search for a place"><button id="searchgo" type="submit">Search</button></form>
    <div id="hits" class="hits"></div>
    <div class="muted">Or click the map to drop a pin.</div>
    <label><span>Radius: <b id="radiusv">120</b> m</span><input type="range" id="radius" min="80" max="250" step="10" value="120"></label>
    <label><span>Shrink: <b id="shrinkv">0.2</b> (1 = real size)</span><input type="range" id="shrink" min="0.02" max="1" step="0.01" value="0.2"></label>
    <label style="grid-auto-flow:column;justify-content:start;gap:6px;align-items:center"><input type="checkbox" id="hills"${q.get('hills') === '0' ? '' : ' checked'}><span>Real hills (ground height from satellite maps)</span></label>
    <label style="grid-auto-flow:column;justify-content:start;gap:6px;align-items:center"><input type="checkbox" id="useready" checked><span>Use a ready place when one is near (loads at once)</span></label>
    <div class="muted">Real buildings are 15 to 40 m tall and a runner jumps under 1 m up, so the place is shrunk.</div>
    <div id="mapphotos"></div>
    <button id="build" class="go" disabled>Build this place</button>
    <button id="slice" disabled>Slice this place</button>
    <div id="slicer" hidden>
      <b>${W('The Slicer', 'Slice')}</b>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:6px 0">
        <input type="range" id="cut" min="0" max="40" step="0.5" value="10" aria-label="Cut height" title="${W('Drag to cut the place at another height', 'Drag to cut the place at another height. The runner starts the lane at this height.')}" style="writing-mode:vertical-lr;direction:rtl;height:170px;width:28px">
        <div style="display:grid;gap:6px"><div>${W('Cut height: <b id="cutv">0</b> m', 'Cut height: <b id="cutv">0</b> m')}</div><div class="muted">${W('where the lane starts', 'metres above the lowest ground, real size')}</div><button id="ladder" type="button">${W('Height lines', 'Contour ladder')}</button></div>
      </div>
      <div id="sliceread" class="say">${W('Press Slice.', 'Pick a place, press Slice.')}</div>
      <div id="slicewhy" class="muted" style="white-space:pre-line"></div>
      <div class="muted" id="stripcap" hidden>${W('Try a height:', 'Heights to try: green looks crossable, amber has a gap or wall in the way, red has no lane. Click one.')}</div>
      <div id="cutstrip" style="display:flex;gap:2px;flex-wrap:wrap"></div>
      <div id="slicelegend" class="legend" ${OLD ? 'hidden' : ''}>
        <span title="The lane the runner takes. Dashed: the simulator is still checking it."><i style="background:#0f6b5c"></i>lane (dashed: checking)</span>
        <span title="Where the ground is exactly this high."><i style="background:#d35400"></i>ground at this height</span>
        <span title="Buildings the cut goes through: you see their floor plan."><i style="background:#e8622c"></i>cut buildings</span>
        <span title="The part of a building above the cut."><i style="background:#c9cfcb"></i>above the cut</span>
        <span title="Heights to try. Shape only, the simulator has not checked them."><i style="background:#cfe8d8"></i>can jump this</span>
        <span title="A gap too wide or a wall too tall on the best line."><i style="background:#f3d9a8"></i>gap or wall in the way</span>
        <span title="No line a runner could use."><i style="background:#e6c4c0"></i>no lane</span>
        <span title="Tint under the map: green is flat, red is steep."><i style="background:linear-gradient(90deg,#7fbf7b,#f1e27a,#e8622c,#a50f15)"></i>ground: flat to steep</span>
      </div>
      <b>${W('Buildings', 'Pick the buildings')}</b>
      <div id="pickcount" class="muted"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button id="pickall" type="button">${W('All', 'Pick all')}</button><button id="pickclear" type="button">Clear</button></div>
      <button id="buildpieces" class="go" type="button">${W('Send to the editor', 'Build the picked buildings')}</button>
      <details id="slicemore" ${OLD ? 'open' : ''}><summary>${W('More', 'Details')}</summary>
        <div class="muted" id="tourhelp">${W('The green line is the best lane at this height. Drag its white dots to turn or move it.', 'The green line is the best of 18 turns and up to 15 sideways steps at this height: the simulator tries the ones with the most different things on them first (a gap, a step, a curve, a wall) and keeps the first it can clear. Drag the white dots to turn it or move it: the dot in the middle moves the whole line.')}</div>
        <button id="tourreset" type="button" hidden>${W('Back to the suggested line', 'Back to the suggested line')}</button>
        <div id="scalewords" class="say"></div>
        <div class="muted">${W('Click a building to leave it out or put it back. Shift and drag picks a box (Alt removes).', 'Click a building to leave it out or put it back. Hold Shift and drag to pick a box (Alt takes buildings out).')}</div>
        ${OLD ? '<div class="muted">Orange line: the ground at this height. Orange blocks: buildings the cut goes through (their floor plan). Faded: above the cut. Green line: the lane the Course would use at this height. Tint under the map: red is steep.</div>' : ''}
      </details>
    </div>
    <div id="say" class="say">No pin yet.</div>
    <a class="btn" href="?mode=editor">Back to the editor</a>
    <div class="muted">Map: OpenFreeMap. Search: Nominatim. Buildings: Overpass. Data © OpenStreetMap contributors (ODbL). ${TERRAIN_ATTRIBUTION}.</div>`;
  const $ = <T extends HTMLElement>(id: string) => side.querySelector('#' + id) as T;
  const radius = $<HTMLInputElement>('radius'), shrink = $<HTMLInputElement>('shrink'), build = $<HTMLButtonElement>('build'), say = $('say'), hits = $('hits');
  const flightcap = document.createElement('div'); flightcap.className = 'fcap'; flightcap.hidden = true; mapEl.appendChild(flightcap);
  const flightskip = document.createElement('button'); flightskip.className = 'fskip'; flightskip.textContent = 'Skip the flight'; flightskip.hidden = true; mapEl.appendChild(flightskip);
  const sliceBtn = $<HTMLButtonElement>('slice'), slicer = $('slicer'), cut = $<HTMLInputElement>('cut'), read = $('sliceread');
  const tell = (s: string, bad = false) => { say.textContent = s; say.classList.toggle('bad', bad); };
  radius.oninput = () => { $('radiusv').textContent = radius.value; };
  radius.onchange = () => places?.prefetch();
  shrink.oninput = () => { $('shrinkv').textContent = shrink.value; };

  const map = new maplibregl.Map({ container: mapEl, style: STYLE, center: [Number(q.get('lon') ?? 2.1649), Number(q.get('lat') ?? 41.3917)], zoom: Number(q.get('z') ?? 15), attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
  const perf = createPerf({ label: 'Map', backend: 'webgl2 (MapLibre)', onDemand: true });
  map.on('render', () => perf.frame());
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ['© OpenStreetMap contributors', 'OpenFreeMap'], compact: false }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  const marker = new maplibregl.Marker({ color: '#0f6b5c' });
  let pin: { lat: number; lon: number } | null = null;
  let places: ReturnType<typeof installPlaces> | null = null;
  // CC-85: a pin inside a place with real photos shows them in the side panel, with the credit under each
  let photos: PhotosHandle | null = null;
  async function showPhotos(lat: number, lon: number) {
    const near = nearestPlace(await loadPhotoIndex(), lat, lon);
    const d = near ? await loadPlacePhotos(near.slug) : null;
    photos?.destroy(); photos = null;
    const box = side.querySelector('#mapphotos') as HTMLElement | null;
    if (d && box) photos = mountPlacePhotos(box, d, { floating: false });
  }
  const dropPin = (lat: number, lon: number) => {
    pin = { lat, lon }; marker.setLngLat([lon, lat]).addTo(map); build.disabled = false; sliceBtn.disabled = false;
    document.documentElement.dataset.pin = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    void showPhotos(lat, lon);
    tell(`Pin at ${lat.toFixed(4)}, ${lon.toFixed(4)}.${places?.snapNote(lat, lon) ?? ''}`);
    places?.prefetch();
  };
  map.on('click', (e) => { if (S) pickClick(e.point); else dropPin(e.lngLat.lat, e.lngLat.lng); });
  places = installPlaces({
    map, side, tell, pin: () => pin, radius: () => Number(radius.value), hills: () => $<HTMLInputElement>('hills').checked,
    setPin: (lat, lon) => dropPin(lat, lon), setRadius: (r) => { radius.value = String(r); $('radiusv').textContent = String(r); },
    groundFor: (lat, lon, r) => groundFor(lat, lon, r),
  });
  map.boxZoom.disable(); // Shift and drag picks a box of buildings here
  map.on('load', () => { document.documentElement.dataset.mapready = 'true'; });
  map.on('error', (e) => { if (!document.documentElement.dataset.mapready) tell(`The map tiles are slow to load (${String(e.error?.message ?? 'network').slice(0, 60)}).`, true); });

  // search: one Nominatim call per press of Search (their policy: at most one request a second, no autocomplete); the browser sends no Referer
  const showHits = (list: { name: string; lat: number; lon: number }[]) => {
    hits.replaceChildren(...list.map((h) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = h.name; b.onclick = () => { map.flyTo({ center: [h.lon, h.lat], zoom: 16, duration: 800 }); dropPin(h.lat, h.lon); }; return b; }));
  };
  const form = $<HTMLFormElement>('searchform');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = $<HTMLInputElement>('search').value.trim(); if (!text) return;
    const go = $<HTMLButtonElement>('searchgo'); go.disabled = true; tell('Searching...');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(text)}`, { referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      showHits(j.map((x) => ({ name: x.display_name.split(',').slice(0, 3).join(','), lat: Number(x.lat), lon: Number(x.lon) })));
      tell(j.length ? 'Pick a result, or click the map.' : 'Nothing found. Try another name.');
    } catch { showHits(PLACES); tell('Search is not answering. Here are some famous places.', true); }
    go.disabled = false;
  };

  const storePiece = (m: ReturnType<typeof osmToMesh>, name: string) => {
    const rd = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
    sessionStorage.setItem(PIECE_KEY, JSON.stringify({ name, positions: rd(m.positions), indices: m.indices }));
  };
  // CC-91: the lane the map proved goes to the editor with the pieces; the editor used to start on its own lane (turn 0, sideways 0, level 0)
  const setLane = (l: PlaceLane | null) => {
    if (!l?.cleared) return;
    try {
      const j = JSON.parse(sessionStorage.getItem(PIECE_KEY) ?? 'null');
      if (!j) return;
      j.lane = { angle: (l.turnDeg * Math.PI) / 180, offset: l.sidewaysM, level: l.levelM, from: 'place' };
      sessionStorage.setItem(PIECE_KEY, JSON.stringify(j));
    } catch { /* the editor then finds a lane of its own */ }
  };
  build.onclick = async () => {
    if (!pin || !places) return;
    build.disabled = true;
    try {
      const o = await places.obtain();
      if (!o) { build.disabled = false; return; }
      places.setStep('mesh', 'doing');
      if (!buildingsFrom(o.answer, o.lat, o.lon).length) { places.setStep('mesh', 'failed', 'No buildings here'); tell('No buildings here. Move the pin and try again.', true); build.disabled = false; return; }
      const k0 = o.lane?.cleared ? o.lane.shrink : Number(shrink.value);
      const setShrink = (k: number) => { shrink.value = String(k); $('shrinkv').textContent = String(k); };
      setShrink(k0);
      const name = (o.name || ($<HTMLInputElement>('search').value.trim().split(',')[0]) || `${o.lat.toFixed(3)},${o.lon.toFixed(3)}`).slice(0, 40);
      const m = osmToMesh(o.answer, o.lat, o.lon, k0, o.ground);
      storePiece(m, name);
      tell(`Built ${m.buildings} buildings${o.ground ? `, on a hill of ${Math.round(relief(o.ground))} m (${m.relief.toFixed(1)} m once shrunk)` : ''}. Open it in the editor, or look at how the pin became a course below.`);
      document.documentElement.dataset.hill = o.ground ? String(Math.round(relief(o.ground))) : '0';
      places.finish(o, m, k0, (k) => { setShrink(k); const m2 = osmToMesh(o.answer, o.lat, o.lon, k, o.ground); storePiece(m2, name); return m2; }, setLane);
    } catch (e) { tell((e as Error).message, true); }
    build.disabled = false;
  };
  // ---- the Slicer (CC-73, Atlas CC-72): a cut height slider; contours, floor plans and the lane at that height
  interface SliceState { picked: Set<number>; answer: OverpassAnswer; lat: number; lon: number; r: number; k: number; ground: Ground | null; fine: Ground | null; tops: ReturnType<typeof buildingTops>; mesh: { positions: number[]; indices: number[] }; pieces: MapPiece[]; range: number }
  let S: SliceState | null = null, sliceWorker: Worker | null = null, laneToken = 0, laneTimer = 0, layersReady = false;
  const laneCache = new Map<string, { quick: LaneSummary | null; proved: LaneSummary | null | undefined }>();
  const empty = { type: 'FeatureCollection' as const, features: [] as unknown[] };
  const num1 = (v: number) => (Math.round(v * 10) / 10).toString();
  const dset = (k: string, v: string | number) => { document.documentElement.dataset[k] = String(v); };
  const ll = (x: number, z: number) => toLonLat(S!.lat, S!.lon, x, z);
  const poly = (ring: [number, number][]) => [[...ring.map(([x, z]) => ll(x, z)), ll(ring[0][0], ring[0][1])]];
  const src = (id: string) => map.getSource(id) as maplibregl.GeoJSONSource;
  const lines = (segs: Seg[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: segs.map((s) => [ll(s[0], s[1]), ll(s[2], s[3])]) } });
  const GREY = '#8f9c94';

  async function groundFor(lat: number, lon: number, r: number): Promise<Ground | null> {
    const key = `cc.map.ground:${lat.toFixed(4)},${lon.toFixed(4)},${r}`;
    try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c) as Ground; } catch { /* no cache */ }
    const g = await fetchGround(lat, lon, r, decodePng);
    try { sessionStorage.setItem(key, JSON.stringify(g)); } catch { /* too big to cache */ }
    return g;
  }

  function ensureLayers() {
    if (layersReady) return;
    const add = (l: Record<string, unknown>) => map.addLayer(l as never); // the layer specs use expressions; the types are strict about them
    for (const id of ['slope', 'below', 'above', 'face', 'plane', 'contour', 'ladder', 'lane', 'out', 'pick', 'skip', 'circle']) map.addSource('sl-' + id, { type: 'geojson', data: empty as never });
    const ext = (id: string, color: string, opacity: number) => add({ id: 'sl-' + id, type: 'fill-extrusion', source: 'sl-' + id, paint: { 'fill-extrusion-color': color, 'fill-extrusion-opacity': opacity, 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'] } });
    add({ id: 'sl-slope', type: 'fill', source: 'sl-slope', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'deg'], 0, '#7fbf7b', 8, '#f1e27a', 18, '#e8622c', 30, '#a50f15'], 'fill-opacity': 0.22 } });
    ext('out', '#b8beb9', 0.1); ext('below', GREY, 0.9); ext('above', GREY, 0.14); ext('face', '#e8622c', 0.95); ext('plane', '#2aa198', 0.28);
    add({ id: 'sl-pick', type: 'line', source: 'sl-pick', paint: { 'line-color': '#e8622c', 'line-width': 2.5 } });
    add({ id: 'sl-skip', type: 'line', source: 'sl-skip', paint: { 'line-color': '#7a847e', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
    add({ id: 'sl-circle', type: 'line', source: 'sl-circle', paint: { 'line-color': '#0f6b5c', 'line-width': 3, 'line-dasharray': [3, 2] } });
    add({ id: 'sl-contour', type: 'line', source: 'sl-contour', paint: { 'line-color': '#d35400', 'line-width': 3.5 } });
    add({ id: 'sl-ladder', type: 'line', source: 'sl-ladder', layout: { visibility: 'none' }, paint: { 'line-color': '#7a5230', 'line-width': 1.3, 'line-opacity': 0.85 } });
    add({ id: 'sl-lane-dash', type: 'line', source: 'sl-lane', layout: { visibility: 'none' }, paint: { 'line-color': '#0f6b5c', 'line-width': 6, 'line-dasharray': [1.4, 1.2] } });
    add({ id: 'sl-lane', type: 'line', source: 'sl-lane', layout: { visibility: 'none' }, paint: { 'line-color': '#0f6b5c', 'line-width': 6 } });
    // the map style draws its own grey 3D buildings; hide them so only the buildings the game builds are cut
    for (const l of map.getStyle().layers) if (l.type === 'fill-extrusion' && !l.id.startsWith('sl-')) map.setLayoutProperty(l.id, 'visibility', 'none');
    layersReady = true;
  }

  // everything that follows the slider at once: the plane, the contour, the cut buildings (the lane waits for the slider to stop)
  function paint(c: number) {
    if (!S) return;
    $('cutv').textContent = num1(c);
    const cb = cutBuildings(S.tops, c), r = S.r;
    const below: unknown[] = [], above: unknown[] = [], face: unknown[] = [], out: unknown[] = [], pickLines: Seg[] = [], skipLines: Seg[] = [];
    let cutCount = 0;
    cb.forEach((b, i) => {
      const geometry = { type: 'Polygon' as const, coordinates: poly(b.ring) };
      const mx = b.ring.reduce((t, p) => t + p[0], 0) / b.ring.length, mz = b.ring.reduce((t, p) => t + p[1], 0) / b.ring.length;
      const reach = Math.min(1, Math.hypot(mx, mz) / r);
      const f = (base: number, height: number) => ({ type: 'Feature' as const, properties: { base, height, i, reach }, geometry });
      const edge = b.ring.map((p, j) => { const q = b.ring[(j + 1) % b.ring.length]; return [p[0], p[1], q[0], q[1]] as Seg; });
      if (!S!.picked.has(i)) { out.push(f(0, Math.max(0.05, b.top))); skipLines.push(...edge); return; }
      pickLines.push(...edge);
      if (!b.cut) { below.push(f(0, Math.max(0.05, b.top))); return; }
      cutCount++;
      const lo = Math.max(0, c - 0.4);
      below.push(f(0, Math.max(0.02, lo))); face.push(f(lo, Math.max(lo + 0.02, c)));
      if (b.top > c + 0.05) above.push(f(c, b.top));
    });
    const picked = S.picked.size;
    dset('slicePicked', picked); dset('sliceTotal', cb.length);
    $('pickcount').textContent = `Picked ${picked} of ${cb.length} buildings.`;
    const sq: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];
    const plane = { type: 'Feature' as const, properties: { base: Math.max(0, c - 0.2), height: Math.max(0.05, c) }, geometry: { type: 'Polygon' as const, coordinates: poly(sq) } };
    const col = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features });
    src('sl-out').setData(col(out) as never); src('sl-pick').setData(col(pickLines.length ? [lines(pickLines)] : []) as never); src('sl-skip').setData(col(skipLines.length ? [lines(skipLines)] : []) as never);
    src('sl-below').setData(col(below) as never); src('sl-above').setData(col(above) as never); src('sl-face').setData(col(face) as never); src('sl-plane').setData(col([plane]) as never);
    const segs = S.fine ? contourSegments(S.fine, lowest(S.fine) + c, 99) : [];
    src('sl-contour').setData(col(segs.length ? [lines(segs)] : []) as never);
    dset('sliceCut', c); dset('sliceCutBuildings', cutCount); dset('sliceBelowBuildings', picked - cutCount); dset('sliceContourSegs', segs.length);
  }

  function drawLane(l: LaneSummary | null, proved: boolean) {
    const has = !!l && !!S;
    if (has) src('sl-lane').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: laneLine(l!, S!.k).map(([x, z]) => ll(x, z)) } } as never);
    map.setLayoutProperty('sl-lane-dash', 'visibility', has && !proved ? 'visible' : 'none');
    map.setLayoutProperty('sl-lane', 'visibility', has && proved ? 'visible' : 'none');
    if (!tour) placeHandles(has ? (laneLine(l!, S!.k) as [[number, number], [number, number]]) : null);
    else placeHandles(tour);
  }

  let shownLane: { c: number; l: LaneSummary; proved: boolean } | null = null; // the lane on the screen: this is the one the editor gets
  function showLane(c: number, quick: LaneSummary | null, proved: LaneSummary | null | undefined) {
    shownLane = proved ? { c, l: proved, proved: true } : quick ? { c, l: quick, proved: false } : null;
    const head = OLD ? `Cut at ${num1(c)} m: ` : `${num1(c)} m: `;
    if (proved) { drawLane(proved, true); read.textContent = OLD ? `${head}the lane is ${Math.round(proved.length)} m long in the game, clearable.` : `${head}${Math.round(proved.length)} m lane, a path exists.`; dset('sliceLane', 'clearable'); dset('sliceLaneLength', Math.round(proved.length)); }
    else if (proved === null && quick) { drawLane(quick, false); read.textContent = OLD ? `${head}a lane of ${Math.round(quick.length)} m, but the simulator could not clear it.` : `${head}${Math.round(quick.length)} m lane, but no path found.`; dset('sliceLane', 'not-clearable'); }
    else if (proved === null) { drawLane(null, false); read.textContent = OLD ? `${head}no lane here (too short, too steep, or nothing to run on).` : `${head}no lane here.`; dset('sliceLane', 'none'); }
    else if (quick) { drawLane(quick, false); read.textContent = OLD ? `${head}a lane of ${Math.round(quick.length)} m; checking that it can be cleared…` : `${head}${Math.round(quick.length)} m lane, checking…`; dset('sliceLane', 'checking'); }
    else { drawLane(null, false); read.textContent = OLD ? `${head}looking for a lane…` : `${head}looking…`; dset('sliceLane', 'working'); }
    lastLane = { c, quick, proved };
    showWhy(c, quick, proved);
    if (proved !== undefined) askStrip();
  }

  // ---- CC-92: why a height fails, and a strip of heights to try
  type StripCell = StripRow & { real: number };
  let lastLane: { c: number; quick: LaneSummary | null; proved: LaneSummary | null | undefined } | null = null, strip: { key: string; cells: StripCell[] } | null = null, stripWorker: Worker | null = null, stripToken = 0;
  const stripEl = $('cutstrip'), whyEl = $('slicewhy'), stripCap = $('stripcap');
  const nearestCrossable = (c: number): number | null => {
    const ok = (strip?.cells ?? []).filter((x) => x.crossable && x.real !== c);
    if (!ok.length) return null;
    return ok.reduce((b, x) => (Math.abs(x.real - c) < Math.abs(b.real - c) ? x : b)).real;
  };
  function drawStrip() {
    stripEl.replaceChildren(); stripCap.hidden = !strip;
    if (!strip) return;
    for (const x of strip.cells) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = String(x.real);
      const f = x.facts;
      b.title = OLD ? (x.lane && f ? `Cut at ${x.real} m: lane ${Math.round(f.lengthM)} m, widest gap ${f.widestGapM.toFixed(1)} m, tallest step ${f.tallestStepM.toFixed(1)} m, ${Math.round(f.solidShare * 100)}% of it has ground under it.` : `Cut at ${x.real} m: no lane a runner could use.`) : (x.lane && f ? `Cut at ${x.real} m: ${x.crossable ? 'looks crossable' : 'something is in the way'}. Lane ${Math.round(f.lengthM)} m, widest gap ${f.widestGapM.toFixed(1)} m, tallest wall ${f.tallestStepM.toFixed(1)} m. Click to try it.` : `Cut at ${x.real} m: no lane. Click to try it.`);
      b.style.cssText = `padding:2px 6px;font:600 12px system-ui,sans-serif;border:1px solid #17201d33;border-radius:6px;cursor:pointer;background:${x.crossable ? '#cfe8d8' : x.lane ? '#f3d9a8' : '#e6c4c0'}`;
      b.onclick = () => { cut.value = String(x.real); cut.dispatchEvent(new Event('input')); cut.dispatchEvent(new Event('change')); };
      stripEl.append(b);
    }
    dset('sliceStrip', JSON.stringify(strip.cells.map((x) => [x.real, x.lane ? (x.crossable ? 'ok' : 'blocked') : 'none'])));
  }
  function askStrip() {
    if (!S) return;
    const key = `${S.k}|${[...S.picked].sort((a, b) => a - b).join('.')}|${S.r}`;
    if (strip?.key === key) return;
    const my = ++stripToken; stripWorker?.terminate(); stripWorker = null;
    const reals = Array.from({ length: 10 }, (_, i) => Math.max(0.5, Math.round((S!.range * (i + 0.5)) / 10 * 2) / 2));
    try { stripWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { return; }
    stripWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.id !== my || a.phase !== 'strip') return;
      strip = { key, cells: a.rows.map((r, i) => ({ ...r, real: reals[i] })) }; stripWorker?.terminate(); stripWorker = null;
      drawStrip(); if (lastLane) showWhy(lastLane.c, lastLane.quick, lastLane.proved);
    };
    stripWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, level: 0, strip: reals.map((c) => c * S!.k) } satisfies SliceAsk);
  }
  const setCut = (v: number) => { cut.value = String(v); cut.dispatchEvent(new Event('input')); cut.dispatchEvent(new Event('change')); };
  function runSuggestion(a: Suggestion['action']) {
    if (a.kind === 'cut') setCut(a.value);
    else if (a.kind === 'shrink') { shrink.value = String(a.value); $('shrinkv').textContent = String(a.value); shrink.dispatchEvent(new Event('change')); }
    else if (a.kind === 'pickall') $('pickall').click();
  }
  // CC-179: one plain reason and up to three ranked fixes from built-in rules (src/slice/suggest.ts), no language model
  function showWhyNew(c: number, quick: LaneSummary | null) {
    if (!S) return;
    const a = explainNoPath({ facts: quick?.facts ?? null, k: S.k, cut: c, strip: (strip?.cells ?? []).map((x) => ({ real: x.real, lane: x.lane, crossable: x.crossable })), picked: S.picked.size, total: S.tops.length });
    const reason = document.createElement('div'); reason.className = 'say bad'; reason.textContent = a.reason; whyEl.append(reason);
    if (a.suggestions.length) {
      const box = document.createElement('div'); box.className = 'fix';
      const h = document.createElement('div'); h.textContent = 'Try one of these:'; box.append(h);
      a.suggestions.forEach((sg, n) => {
        const row = document.createElement('div');
        if (sg.action.kind === 'drag') row.textContent = `${n + 1}. ${sg.text}`;
        else { const b = document.createElement('button'); b.type = 'button'; b.className = 'sugg'; b.textContent = `${n + 1}. ${sg.text}`; b.title = 'Click: change it and check again'; b.onclick = () => runSuggestion(sg.action); row.append(b); }
        box.append(row);
      });
      whyEl.append(box);
    }
    dset('sliceWhy', a.reason); dset('sliceWhyKind', a.kind); dset('sliceFixes', JSON.stringify(a.suggestions.map((x) => x.action)));
  }
  function showWhy(c: number, quick: LaneSummary | null, proved: LaneSummary | null | undefined) {
    whyEl.replaceChildren();
    if (proved !== null) return; // cleared, or still working
    if (!OLD) { showWhyNew(c, quick); return; }
    const lines = quick?.facts ? whyNot(quick.facts).lines : ['No lane here: every line across this cut meets a wall taller than a climb, a fall longer than a roll survives, or too little to run on.'];
    whyEl.append(document.createTextNode(lines.join('\n')));
    const best = nearestCrossable(c);
    if (best !== null) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = `Try the cut at ${best} m`; b.style.marginTop = '4px'; b.style.display = 'block';
      b.onclick = () => { cut.value = String(best); cut.dispatchEvent(new Event('input')); cut.dispatchEvent(new Event('change')); };
      whyEl.append(b);
    }
    dset('sliceWhy', lines[0] ?? '');
  }

  // ---- CC-93: drag and rotate the tour line
  let tour: [[number, number], [number, number]] | null = null; // the player's own line, in real metres east (x) and south (z) of the pin
  const handles: maplibregl.Marker[] = [];
  const fromLL = (lng: number, lat: number): [number, number] => [(lng - S!.lon) * 111320 * Math.cos((S!.lat * Math.PI) / 180), -(lat - S!.lat) * 111320];
  const handleAt = (i: number) => { const p = handles[i].getLngLat(); return fromLL(p.lng, p.lat); };
  const customOf = (t: [[number, number], [number, number]]) => {
    let angle = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
    if (angle < 0) angle += Math.PI;
    if (angle >= Math.PI) angle -= Math.PI;
    return { angle, offset: (t[0][0] * -Math.sin(angle) + t[0][1] * Math.cos(angle)) * S!.k }; // the lane lives in the shrunk place: real metres times the shrink
  };
  const tourReset = $<HTMLButtonElement>('tourreset');
  function previewLine(a: [number, number], b: [number, number]) {
    src('sl-lane').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [ll(a[0], a[1]), ll(b[0], b[1])] } } as never);
    map.setLayoutProperty('sl-lane-dash', 'visibility', 'visible'); map.setLayoutProperty('sl-lane', 'visibility', 'none');
  }
  function commitTour() {
    if (!S || handles.length < 3) return;
    const a = handleAt(0), b = handleAt(1);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) { tell('Drag the dots further apart: the line needs at least 4 m.', true); return; }
    tour = [a, b]; tourReset.hidden = false;
    dset('tourLine', JSON.stringify(tour.map((p) => p.map((v) => Math.round(v)))));
    askLane(Number(cut.value));
  }
  function placeHandles(line: [[number, number], [number, number]] | null) {
    if (!S) return;
    if (!line) { for (const h of handles) h.remove(); return; }
    if (!handles.length) {
      const names = ['Drag to turn the line (this end)', 'Drag to turn the line (the other end)', 'Drag to move the whole line'];
      names.forEach((title, i) => {
        const el = document.createElement('div'); el.title = title; el.id = ['tour-a', 'tour-b', 'tour-m'][i];
        el.style.cssText = `width:${i === 2 ? 14 : 18}px;height:${i === 2 ? 14 : 18}px;border-radius:${i === 2 ? 3 : 50}%;background:#fff;border:3px solid #0f6b5c;cursor:grab;box-shadow:0 1px 4px #0006`;
        const h = new maplibregl.Marker({ element: el, draggable: true });
        h.on('drag', () => {
          if (i === 2) { // the middle dot moves both ends by the same step
            const m = handleAt(2), a = handleAt(0), b = handleAt(1), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, dx = m[0] - cx, dz = m[1] - cz;
            const na: [number, number] = [a[0] + dx, a[1] + dz], nb: [number, number] = [b[0] + dx, b[1] + dz];
            handles[0].setLngLat(ll(na[0], na[1])); handles[1].setLngLat(ll(nb[0], nb[1])); previewLine(na, nb);
          } else {
            const a = handleAt(0), b = handleAt(1);
            handles[2].setLngLat(ll((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); previewLine(a, b);
          }
        });
        h.on('dragend', commitTour);
        handles.push(h);
      });
    }
    const [a, b] = line;
    [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number]].forEach((p, i) => handles[i].setLngLat(ll(p[0], p[1])).addTo(map));
  }
  tourReset.onclick = () => { tour = null; tourReset.hidden = true; dset('tourLine', ''); askLane(Number(cut.value)); };

  function askLane(c: number) {
    if (!S) return;
    const custom = tour ? customOf(tour) : undefined;
    const key = `${c}|${S.k}|${S.r}|${[...S.picked].sort((a, b) => a - b).join('.')}${custom ? `|${custom.angle.toFixed(3)},${custom.offset.toFixed(2)}` : ''}`, hit = laneCache.get(key);
    const my = ++laneToken; sliceWorker?.terminate(); sliceWorker = null;
    if (hit && hit.proved !== undefined) { showLane(c, hit.quick, hit.proved); return; }
    showLane(c, null, undefined); dset('sliceLane', 'working');
    try { sliceWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { read.textContent = 'This browser cannot run the lane search in the background.'; return; }
    let quick: LaneSummary | null = null;
    sliceWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.id !== my || a.phase === 'strip') return;
      if (a.phase === 'quick') { quick = a.lane; laneCache.set(key, { quick, proved: undefined }); showLane(c, quick, undefined); }
      else { laneCache.set(key, { quick, proved: a.lane }); showLane(c, quick, a.lane); }
    };
    sliceWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, level: c * S.k, pieces: S.pieces, ...(custom ? { custom } : {}) } satisfies SliceAsk);
  }

  const cutChanged = (instant: boolean) => {
    const c = Number(cut.value); paint(c);
    clearTimeout(laneTimer);
    if (instant) askLane(c); else laneTimer = window.setTimeout(() => askLane(c), 500);
  };
  cut.oninput = () => cutChanged(false);
  cut.onchange = () => cutChanged(true);

  function rebuild() { // the place at the current shrink: the roofs and the mesh the lane is cut from
    if (!S) return;
    const answer = S.answer, k = Number(shrink.value), bs = buildingsFrom(answer, S.lat, S.lon);
    S.k = k; S.tops = buildingTops(bs, k, S.ground);
    const picked = S.picked, m = extrude(S.tops.filter((_, i) => picked.has(i)).map((t) => t.b), k, S.ground); S.mesh = { positions: m.positions, indices: m.indices };
    S.pieces = piecesFrom(S.tops, picked, k, S.ground); // the very pieces "Send to the editor" hands over: the check reads the lane from them (CC-179)
    $('scalewords').textContent = scaleWords(S.r, k, bs.length ? bs.map((b) => b.h).sort((a, b2) => a - b2)[Math.floor(bs.length / 2)] : 9);
    S.range = cutRange(S.tops, S.ground);
  }
  shrink.onchange = () => { if (!S) return; rebuild(); cut.max = String(S.range); cutChanged(true); };

  const ladderBtn = $<HTMLButtonElement>('ladder');
  let ladderOn = false;
  ladderBtn.onclick = () => {
    if (!S?.fine) { read.textContent = 'This place is flat in the height maps, so there are no contour lines.'; return; }
    ladderOn = !ladderOn;
    const rel = relief(S.ground), levels = ladderLevels(rel);
    src('sl-ladder').setData({ type: 'FeatureCollection', features: ladderOn ? levels.map((h) => lines(contourSegments(S!.fine!, lowest(S!.fine!) + h, 99))) : [] } as never);
    map.setLayoutProperty('sl-ladder', 'visibility', ladderOn ? 'visible' : 'none');
    ladderBtn.textContent = ladderOn ? 'Hide the contour ladder' : 'Contour ladder';
    if (ladderOn) read.textContent = `Lines every ${ladderStep(rel)} m, from ${levels[0]} m up to ${levels[levels.length - 1]} m. Lines close together mean steep ground.`;
    dset('ladderLines', ladderOn ? levels.length : 0);
  };

  // ---- the flight (CC-79): steps 1 to 3 here; step 4 (the hand-over to the editor) is the Build button
  const setWave = (w: number | null) => {
    const k = w === null ? null : ['max', 0, ['min', 1, ['-', ['*', w, 1.6], ['*', ['get', 'reach'], 0.6]]]];
    for (const id of ['sl-out', 'sl-below', 'sl-above', 'sl-face']) {
      map.setPaintProperty(id, 'fill-extrusion-height', (k ? ['*', ['get', 'height'], k] : ['get', 'height']) as never);
      map.setPaintProperty(id, 'fill-extrusion-base', (k ? ['*', ['get', 'base'], k] : ['get', 'base']) as never);
    }
  };
  let skipFlight: (() => void) | null = null;
  function flyIn(fit: number) {
    const q2 = new URLSearchParams(location.search), at = q2.get('flightat');
    const reduced = reducedMotion() || q2.get('flight') === '0';
    const end = () => {
      setWave(null); skipFlight = null; flightcap.hidden = true; flightskip.hidden = true;
      map.setLayoutProperty('sl-plane', 'visibility', 'visible'); slicer.hidden = false;
      dset('flightDone', '1'); cutChanged(true);
    };
    paint(S!.range); // while the buildings rise nothing is cut: the whole place is solid
    map.setLayoutProperty('sl-plane', 'visibility', 'none'); slicer.hidden = at !== null ? false : true;
    flightcap.hidden = false; flightskip.hidden = at !== null || reduced;
    const f = runFlight({
      camera: (c) => map.jumpTo({ center: [S!.lon, S!.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }),
      wave: (w) => setWave(w), say: (t) => { flightcap.textContent = t; }, end,
    }, fit, S!.r, { at: at !== null ? Number(at) : undefined, reduced });
    if (!reduced && at === null) skipFlight = f.skip;
    flightskip.onclick = () => f.skip();
    if (at !== null) dset('flightAt', at);
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && skipFlight) skipFlight(); });

  // ---- picking: click a building, or hold Shift and drag a box (Alt takes buildings out)
  const PICK_LAYERS = ['sl-below', 'sl-face', 'sl-above', 'sl-out'];
  const ids = (fs: maplibregl.MapGeoJSONFeature[]) => [...new Set(fs.map((f) => Number(f.properties?.i)).filter((n) => Number.isFinite(n)))];
  function picksChanged() { if (!S) return; rebuild(); paint(Number(cut.value)); clearTimeout(laneTimer); laneTimer = window.setTimeout(() => askLane(Number(cut.value)), 500); }
  function pickClick(pt: maplibregl.Point) {
    if (!S || skipFlight) return;
    const hit = ids(map.queryRenderedFeatures([pt.x, pt.y], { layers: PICK_LAYERS }));
    if (!hit.length) return;
    for (const i of hit.slice(0, 1)) { if (S.picked.has(i)) S.picked.delete(i); else S.picked.add(i); }
    picksChanged();
  }
  $('pickall').onclick = () => { if (!S) return; S.picked = new Set(S.tops.keys()); picksChanged(); };
  $('pickclear').onclick = () => { if (!S) return; S.picked = new Set(); picksChanged(); };
  const boxHost = map.getCanvasContainer();
  let box: { x0: number; y0: number; el: HTMLDivElement } | null = null;
  boxHost.addEventListener('mousedown', (e) => {
    if (!S || !e.shiftKey || skipFlight) return;
    e.preventDefault(); e.stopPropagation(); map.dragPan.disable();
    const r = boxHost.getBoundingClientRect(), el = document.createElement('div');
    el.style.cssText = 'position:absolute;border:2px dashed #e8622c;background:rgba(232,98,44,.12);pointer-events:none;z-index:5';
    boxHost.appendChild(el); box = { x0: e.clientX - r.left, y0: e.clientY - r.top, el };
  }, true);
  window.addEventListener('mousemove', (e) => {
    if (!box) return;
    const r = boxHost.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    Object.assign(box.el.style, { left: Math.min(x, box.x0) + 'px', top: Math.min(y, box.y0) + 'px', width: Math.abs(x - box.x0) + 'px', height: Math.abs(y - box.y0) + 'px' });
  });
  window.addEventListener('mouseup', (e) => {
    if (!box || !S) return;
    const r = boxHost.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = box;
    box = null; b.el.remove(); map.dragPan.enable();
    if (Math.abs(x - b.x0) < 4 && Math.abs(y - b.y0) < 4) return;
    const hit = ids(map.queryRenderedFeatures([[Math.min(x, b.x0), Math.min(y, b.y0)], [Math.max(x, b.x0), Math.max(y, b.y0)]], { layers: PICK_LAYERS }));
    for (const i of hit) { if (e.altKey) S.picked.delete(i); else S.picked.add(i); }
    picksChanged();
  });

  // step 4: the picked buildings go to the editor as separate pieces, with the camera heading and tilt the player ended on
  $('buildpieces').onclick = () => {
    if (!S) return;
    const pieces = S.pieces;
    if (!pieces.length) { tell('Pick at least one building first.', true); return; }
    const lane = shownLane && shownLane.c === Number(cut.value) ? { ...handoverLane(shownLane.l, shownLane.c, S.k), from: shownLane.proved ? 'slicer' : 'slicer-unproved' } : undefined;
    try { sessionStorage.setItem(PIECE_KEY, JSON.stringify({ name: 'Place', pieces, ...(lane ? { lane } : {}), camera: { heading: map.getBearing(), pitch: map.getPitch(), distance: Math.max(12, S.r * S.k * 1.8) } })); } catch { tell('That is too many buildings to hand over at once. Pick fewer.', true); return; }
    dset('handover', pieces.length);
    mapEl.style.transition = 'opacity .4s'; mapEl.style.opacity = '0.2';
    setTimeout(() => { location.search = '?mode=editor'; }, 450);
  };
  if (q.get('hooks') === '1') (window as unknown as Record<string, unknown>).__ccMap = { map, tops: () => S?.tops ?? [], picked: () => [...(S?.picked ?? [])], tourHandles: () => handles.map((h) => h.getLngLat()), tourDrag: (i: number, x: number, z: number) => { handles[i].setLngLat(ll(x, z)); handles[i].fire('drag'); handles[i].fire('dragend'); } };

  sliceBtn.onclick = async () => {
    if (!pin || !places) return;
    sliceBtn.disabled = true;
    try {
      const o = await places.obtain();
      if (!o) { sliceBtn.disabled = false; return; }
      const r = o.radius, answer = o.answer, ground = o.ground;
      if (!buildingsFrom(answer, pin.lat, pin.lon).length && !ground) { tell('Nothing to slice here. Move the pin and try again.', true); sliceBtn.disabled = false; return; }
      S = { picked: new Set(), answer, lat: pin.lat, lon: pin.lon, r, k: Number(shrink.value), ground, fine: ground ? resample(ground, 4) : null, tops: [], mesh: { positions: [], indices: [] }, pieces: [], range: 0 };
      rebuild(); S.picked = new Set(S.tops.keys()); rebuild();
      if (!map.isStyleLoaded()) await new Promise<void>((res) => map.once('idle', () => res()));
      ensureLayers();
      src('sl-slope').setData({ type: 'FeatureCollection', features: ground ? slopeCells(ground).map((c) => ({ type: 'Feature', properties: { deg: c.deg }, geometry: { type: 'Polygon', coordinates: poly([[c.x0, c.z0], [c.x1, c.z0], [c.x1, c.z1], [c.x0, c.z1]]) } })) : [] } as never);
      src('sl-circle').setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [Array.from({ length: 65 }, (_, i) => ll(r * Math.cos((i / 64) * 2 * Math.PI), r * Math.sin((i / 64) * 2 * Math.PI)))] } } as never);
      cut.min = '0'; cut.max = String(S.range); cut.step = '0.5'; cut.value = String(Math.round(S.range * 0.35 * 2) / 2);
      tell(`Sliced ${S.tops.length} buildings${ground ? `, ground ${Math.round(relief(ground))} m from the lowest to the highest point` : ' (flat ground)'}. Drag the cut height.`);
      dset('sliceReady', '1'); dset('sliceRange', S.range); dset('sliceRelief', Math.round(relief(ground)));
      const fit = Math.min(18.5, Math.log2((156543 * Math.cos((pin.lat * Math.PI) / 180) * 900) / (3 * r)));
      flyIn(fit);
    } catch (e) { tell((e as Error).message, true); }
    sliceBtn.disabled = false;
  };
  return { backend: 'webgl2' };
}
