// ?mode=map: pick a place on a real map, press "Build this place", and its buildings arrive in the world editor as one piece (CC-48).
// Map: MapLibre GL with OpenFreeMap tiles (no key). Search: Nominatim (no key, one call per search). Buildings: Overpass (no key).
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { buildingsFrom, MIRRORS, osmToMesh, overpassQuery, type OverpassAnswer } from '../world/osm';
import { fetchGround, relief, TERRAIN_ATTRIBUTION, type Ground, type Tile } from '../world/terrain';

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
    <div id="say" class="say">No pin yet.</div>
    <a class="btn" href="?mode=editor">Back to the editor</a>
    <div class="muted">Map: OpenFreeMap. Search: Nominatim. Buildings: Overpass. Data © OpenStreetMap contributors (ODbL). ${TERRAIN_ATTRIBUTION}.</div>`;
  const $ = <T extends HTMLElement>(id: string) => side.querySelector('#' + id) as T;
  const radius = $<HTMLInputElement>('radius'), shrink = $<HTMLInputElement>('shrink'), build = $<HTMLButtonElement>('build'), say = $('say'), hits = $('hits');
  const tell = (s: string, bad = false) => { say.textContent = s; say.classList.toggle('bad', bad); };
  radius.oninput = () => { $('radiusv').textContent = radius.value; };
  shrink.oninput = () => { $('shrinkv').textContent = shrink.value; };

  const map = new maplibregl.Map({ container: mapEl, style: STYLE, center: [Number(q.get('lon') ?? 2.1649), Number(q.get('lat') ?? 41.3917)], zoom: Number(q.get('z') ?? 15), attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ['© OpenStreetMap contributors', 'OpenFreeMap'], compact: false }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  const marker = new maplibregl.Marker({ color: '#0f6b5c' });
  let pin: { lat: number; lon: number } | null = null;
  const dropPin = (lat: number, lon: number) => {
    pin = { lat, lon }; marker.setLngLat([lon, lat]).addTo(map); build.disabled = false;
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
  return { backend: 'webgl2' };
}
