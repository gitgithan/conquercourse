// ?mode=map: pick a place on a real map, press "Build this place", and its buildings arrive in the world editor as one piece (CC-48).
// Map: MapLibre GL with OpenFreeMap tiles (no key). Search: Nominatim (no key, one call per search). Buildings: Overpass (no key).
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { buildingsFrom, MIRRORS, osmToMesh, overpassQuery, type OverpassAnswer } from '../world/osm';
import { fetchGround, lowest, relief, TERRAIN_ATTRIBUTION, type Ground, type Tile } from '../world/terrain';
import { buildingTops, contourSegments, cutBuildings, cutRange, ladderLevels, ladderStep, laneLine, resample, slopeCells, toLonLat, type Seg } from '../slice/slicer';
import type { LaneSummary, SliceAnswer, SliceAsk } from '../slice/slicer-worker';

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

async function overpass(lat: number, lon: number, radius: number, say: (s: string) => void): Promise<OverpassAnswer> {
  const key = `cc.map.overpass:${lat.toFixed(4)},${lon.toFixed(4)},${radius}`; // one query per place
  try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c) as OverpassAnswer; } catch { /* no cache */ }
  let wait = 3000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    say(`Asking the map data servers (try ${attempt + 1} of 6)...`);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(overpassQuery(lat, lon, radius)), signal: AbortSignal.timeout(60000) });
      if (r.ok) {
        const j = (await r.json()) as OverpassAnswer;
        const keep = ['building', 'height', 'building:levels']; // keep the cache small: tags that matter only
        for (const e of j.elements) if (e.tags) e.tags = Object.fromEntries(Object.entries(e.tags).filter(([k]) => keep.includes(k)));
        try { sessionStorage.setItem(key, JSON.stringify({ elements: j.elements })); } catch { /* too big to cache */ }
        return j;
      }
    } catch { /* try the next mirror */ }
    await new Promise((r) => setTimeout(r, wait)); wait = Math.min(wait * 2, 15000);
  }
  throw new Error('The map data servers did not answer. Try again in a minute.');
}

export function startMap(host: HTMLElement): { backend: 'webgl2' } {
  maplibregl.setWorkerUrl(workerUrl); // Vite's dev server cannot find the worker by itself
  const q = new URLSearchParams(location.search);
  const style = document.createElement('style');
  style.textContent = `
    .mp{font:14px/1.35 system-ui,sans-serif;color:#17201d;position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 280px}
    .mp .map{min-width:0;min-height:0}.mp .side{padding:10px;display:grid;gap:8px;align-content:start;background:#eef1ec;overflow:auto}
    .mp h1{margin:0;font-size:18px}.mp .muted{color:#58635d;font-size:12px}.mp label{display:grid;gap:1px;font-size:13px}.mp input[type=range]{width:100%;margin:0}
    .mp button,.mp input[type=search],.mp a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:4px 9px;cursor:pointer;text-decoration:none;box-sizing:border-box}
    .mp input[type=search]{width:100%;cursor:text}.mp .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.mp button:disabled{opacity:.5;cursor:default}
    .mp [hidden]{display:none!important}
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
    <div class="muted">Real buildings are 15 to 40 m tall and a runner jumps under 1 m up, so the place is shrunk.</div>
    <button id="build" class="go" disabled>Build this place</button>
    <button id="slice" disabled>Slice this place</button>
    <div id="slicer" hidden>
      <b>The Slicer</b>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:6px 0">
        <input type="range" id="cut" min="0" max="40" step="0.5" value="10" aria-label="Cut height" style="writing-mode:vertical-lr;direction:rtl;height:170px;width:28px">
        <div style="display:grid;gap:6px"><div>Cut height: <b id="cutv">0</b> m</div><div class="muted">metres above the lowest ground, real size</div><button id="ladder" type="button">Contour ladder</button></div>
      </div>
      <div id="sliceread" class="say">Pick a place, press Slice.</div>
      <div class="muted">Orange line: the ground at this height. Orange blocks: buildings the cut goes through (their floor plan). Faded: above the cut. Green line: the lane the Course would use at this height. Tint under the map: red is steep.</div>
    </div>
    <div id="say" class="say">No pin yet.</div>
    <a class="btn" href="?mode=editor">Back to the editor</a>
    <div class="muted">Map: OpenFreeMap. Search: Nominatim. Buildings: Overpass. Data © OpenStreetMap contributors (ODbL). ${TERRAIN_ATTRIBUTION}.</div>`;
  const $ = <T extends HTMLElement>(id: string) => side.querySelector('#' + id) as T;
  const radius = $<HTMLInputElement>('radius'), shrink = $<HTMLInputElement>('shrink'), build = $<HTMLButtonElement>('build'), say = $('say'), hits = $('hits');
  const sliceBtn = $<HTMLButtonElement>('slice'), slicer = $('slicer'), cut = $<HTMLInputElement>('cut'), read = $('sliceread');
  const tell = (s: string, bad = false) => { say.textContent = s; say.classList.toggle('bad', bad); };
  radius.oninput = () => { $('radiusv').textContent = radius.value; };
  shrink.oninput = () => { $('shrinkv').textContent = shrink.value; };

  const map = new maplibregl.Map({ container: mapEl, style: STYLE, center: [Number(q.get('lon') ?? 2.1649), Number(q.get('lat') ?? 41.3917)], zoom: Number(q.get('z') ?? 15), attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ['© OpenStreetMap contributors', 'OpenFreeMap'], compact: false }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  const marker = new maplibregl.Marker({ color: '#0f6b5c' });
  let pin: { lat: number; lon: number } | null = null;
  const dropPin = (lat: number, lon: number) => {
    pin = { lat, lon }; marker.setLngLat([lon, lat]).addTo(map); build.disabled = false; sliceBtn.disabled = false;
    document.documentElement.dataset.pin = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    tell(`Pin at ${lat.toFixed(4)}, ${lon.toFixed(4)}.`);
  };
  map.on('click', (e) => dropPin(e.lngLat.lat, e.lngLat.lng));
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

  build.onclick = async () => {
    if (!pin) return;
    build.disabled = true;
    try {
      const r = Number(radius.value), answer = await overpass(pin.lat, pin.lon, r, (s) => tell(s));
      const bs = buildingsFrom(answer, pin.lat, pin.lon);
      if (!bs.length) { tell('No buildings here. Move the pin and try again.', true); build.disabled = false; return; }
      let ground: Ground | null = null;
      if ($<HTMLInputElement>('hills').checked) {
        tell('Reading the height of the ground...');
        try { ground = await fetchGround(pin.lat, pin.lon, r, decodePng); } catch { tell('The height maps did not answer, so the place is built flat.', true); }
      }
      const m = osmToMesh(answer, pin.lat, pin.lon, Number(shrink.value), ground);
      const name = (($<HTMLInputElement>('search').value.trim().split(',')[0]) || `${pin.lat.toFixed(3)},${pin.lon.toFixed(3)}`).slice(0, 40);
      const rd = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
      sessionStorage.setItem(PIECE_KEY, JSON.stringify({ name, positions: rd(m.positions), indices: m.indices }));
      tell(`Built ${m.buildings} buildings${ground ? `, on a hill of ${Math.round(relief(ground))} m (${m.relief.toFixed(1)} m once shrunk)` : ''}. Opening the editor...`);
      document.documentElement.dataset.hill = ground ? String(Math.round(relief(ground))) : '0';
      location.search = '?mode=editor';
    } catch (e) { tell((e as Error).message, true); build.disabled = false; }
  };
  // ---- the Slicer (CC-73, Atlas CC-72): a cut height slider; contours, floor plans and the lane at that height
  interface SliceState { answer: OverpassAnswer; lat: number; lon: number; r: number; k: number; ground: Ground | null; fine: Ground | null; tops: ReturnType<typeof buildingTops>; mesh: { positions: number[]; indices: number[] }; range: number }
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
    for (const id of ['slope', 'below', 'above', 'face', 'plane', 'contour', 'ladder', 'lane']) map.addSource('sl-' + id, { type: 'geojson', data: empty as never });
    const ext = (id: string, color: string, opacity: number) => add({ id: 'sl-' + id, type: 'fill-extrusion', source: 'sl-' + id, paint: { 'fill-extrusion-color': color, 'fill-extrusion-opacity': opacity, 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'] } });
    add({ id: 'sl-slope', type: 'fill', source: 'sl-slope', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'deg'], 0, '#7fbf7b', 8, '#f1e27a', 18, '#e8622c', 30, '#a50f15'], 'fill-opacity': 0.22 } });
    ext('below', GREY, 0.9); ext('above', GREY, 0.14); ext('face', '#e8622c', 0.95); ext('plane', '#2aa198', 0.28);
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
    const below: unknown[] = [], above: unknown[] = [], face: unknown[] = [];
    let cutCount = 0;
    for (const b of cb) {
      const geometry = { type: 'Polygon' as const, coordinates: poly(b.ring) };
      const f = (base: number, height: number) => ({ type: 'Feature' as const, properties: { base, height }, geometry });
      if (!b.cut) { below.push(f(0, Math.max(0.05, b.top))); continue; }
      cutCount++;
      const lo = Math.max(0, c - 0.4);
      below.push(f(0, Math.max(0.02, lo))); face.push(f(lo, Math.max(lo + 0.02, c)));
      if (b.top > c + 0.05) above.push(f(c, b.top));
    }
    const sq: [number, number][] = [[-r, -r], [r, -r], [r, r], [-r, r]];
    const plane = { type: 'Feature' as const, properties: { base: Math.max(0, c - 0.2), height: Math.max(0.05, c) }, geometry: { type: 'Polygon' as const, coordinates: poly(sq) } };
    const col = (features: unknown[]) => ({ type: 'FeatureCollection' as const, features });
    src('sl-below').setData(col(below) as never); src('sl-above').setData(col(above) as never); src('sl-face').setData(col(face) as never); src('sl-plane').setData(col([plane]) as never);
    const segs = S.fine ? contourSegments(S.fine, lowest(S.fine) + c, 99) : [];
    src('sl-contour').setData(col(segs.length ? [lines(segs)] : []) as never);
    dset('sliceCut', c); dset('sliceCutBuildings', cutCount); dset('sliceBelowBuildings', cb.length - cutCount); dset('sliceContourSegs', segs.length);
  }

  function drawLane(l: LaneSummary | null, proved: boolean) {
    const has = !!l && !!S;
    if (has) src('sl-lane').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: laneLine(l!, S!.k).map(([x, z]) => ll(x, z)) } } as never);
    map.setLayoutProperty('sl-lane-dash', 'visibility', has && !proved ? 'visible' : 'none');
    map.setLayoutProperty('sl-lane', 'visibility', has && proved ? 'visible' : 'none');
  }

  function showLane(c: number, quick: LaneSummary | null, proved: LaneSummary | null | undefined) {
    const head = `Cut at ${num1(c)} m: `;
    if (proved) { drawLane(proved, true); read.textContent = `${head}the lane is ${Math.round(proved.length)} m long in the game, clearable.`; dset('sliceLane', 'clearable'); dset('sliceLaneLength', Math.round(proved.length)); }
    else if (proved === null && quick) { drawLane(quick, false); read.textContent = `${head}a lane of ${Math.round(quick.length)} m, but the simulator could not clear it.`; dset('sliceLane', 'not-clearable'); }
    else if (proved === null) { drawLane(null, false); read.textContent = `${head}no lane here (too short, too steep, or nothing to run on).`; dset('sliceLane', 'none'); }
    else if (quick) { drawLane(quick, false); read.textContent = `${head}a lane of ${Math.round(quick.length)} m; checking that it can be cleared…`; dset('sliceLane', 'checking'); }
    else { drawLane(null, false); read.textContent = `${head}looking for a lane…`; dset('sliceLane', 'working'); }
  }

  function askLane(c: number) {
    if (!S) return;
    const key = `${c}|${S.k}|${S.r}`, hit = laneCache.get(key);
    const my = ++laneToken; sliceWorker?.terminate(); sliceWorker = null;
    if (hit && hit.proved !== undefined) { showLane(c, hit.quick, hit.proved); return; }
    showLane(c, null, undefined); dset('sliceLane', 'working');
    try { sliceWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { read.textContent = 'This browser cannot run the lane search in the background.'; return; }
    let quick: LaneSummary | null = null;
    sliceWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.id !== my) return;
      if (a.phase === 'quick') { quick = a.lane; laneCache.set(key, { quick, proved: undefined }); showLane(c, quick, undefined); }
      else { laneCache.set(key, { quick, proved: a.lane }); showLane(c, quick, a.lane); }
    };
    sliceWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, level: c * S.k } satisfies SliceAsk);
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
    const m = osmToMesh(answer, S.lat, S.lon, k, S.ground); S.mesh = { positions: m.positions, indices: m.indices };
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

  sliceBtn.onclick = async () => {
    if (!pin) return;
    sliceBtn.disabled = true;
    try {
      const r = Number(radius.value), answer = await overpass(pin.lat, pin.lon, r, (s) => tell(s));
      let ground: Ground | null = null;
      if ($<HTMLInputElement>('hills').checked) {
        tell('Reading the height of the ground...');
        try { ground = await groundFor(pin.lat, pin.lon, r); } catch { tell('The height maps did not answer, so the place is cut flat.', true); }
      }
      if (!buildingsFrom(answer, pin.lat, pin.lon).length && !ground) { tell('Nothing to slice here. Move the pin and try again.', true); sliceBtn.disabled = false; return; }
      S = { answer, lat: pin.lat, lon: pin.lon, r, k: Number(shrink.value), ground, fine: ground ? resample(ground, 4) : null, tops: [], mesh: { positions: [], indices: [] }, range: 0 };
      rebuild();
      if (!map.isStyleLoaded()) await new Promise<void>((res) => map.once('idle', () => res()));
      ensureLayers();
      src('sl-slope').setData({ type: 'FeatureCollection', features: ground ? slopeCells(ground).map((c) => ({ type: 'Feature', properties: { deg: c.deg }, geometry: { type: 'Polygon', coordinates: poly([[c.x0, c.z0], [c.x1, c.z0], [c.x1, c.z1], [c.x0, c.z1]]) } })) : [] } as never);
      cut.min = '0'; cut.max = String(S.range); cut.step = '0.5'; cut.value = String(Math.round(S.range * 0.35 * 2) / 2);
      slicer.hidden = false;
      const zoom = Math.min(18.5, Math.log2((156543 * Math.cos((pin.lat * Math.PI) / 180) * 900) / (3 * r)));
      map.easeTo({ center: [pin.lon, pin.lat], zoom, pitch: 55, bearing: -25, duration: 700 });
      tell(`Sliced ${S.tops.length} buildings${ground ? `, ground ${Math.round(relief(ground))} m from the lowest to the highest point` : ' (flat ground)'}. Drag the cut height.`);
      dset('sliceReady', '1'); dset('sliceRange', S.range); dset('sliceRelief', Math.round(relief(ground)));
      cutChanged(true);
    } catch (e) { tell((e as Error).message, true); }
    sliceBtn.disabled = false;
  };
  return { backend: 'webgl2' };
}
