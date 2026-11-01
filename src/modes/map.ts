// ?mode=map: pick a place on a real map, press "Build this place", and its buildings arrive in the world editor as one piece (CC-48).
// Map: MapLibre GL with OpenFreeMap tiles (no key). Search: Nominatim (no key, one call per search). Buildings: Overpass (no key).
import { simSaysPanel, slicerWords } from '../ui/sim-says';
import { customOf as customOfK, openingFor, provenSummary, sameLine, tourOf, type DefaultsFile, type SlicerDefault } from '../slice/slicer-default';
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
import { LANE_DROP } from '../sim/drop';
import { createPerf } from '../ui/perf';
import { pageQuery } from '../flags';
import { mountStreetPanel, type StreetPanel } from '../ui/street-panel';
import { streetPhotosOn } from '../world/street-photos';

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
  const q = pageQuery();
  const OLD = q.get('slicewords') === 'old'; // CC-179: ?slicewords=old keeps the long text
  const W = (short: string, long: string) => (OLD ? long : short);
  const style = document.createElement('style');
  style.textContent = `
    .mp{font:14px/1.35 system-ui,sans-serif;color:#17201d;position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 340px}
    .mp .map{min-width:0;min-height:0}.mp .side{padding:10px;display:grid;gap:8px;align-content:start;background:#eef1ec;overflow:auto}
    .mp h1{margin:0;font-size:18px}.mp .muted{color:#58635d;font-size:12px}.mp label{display:grid;gap:1px;font-size:13px}.mp input[type=range]{width:100%;margin:0}
    .mp button,.mp input[type=search],.mp a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:4px 9px;cursor:pointer;text-decoration:none;box-sizing:border-box}
    .mp input[type=search]{width:100%;cursor:text}.mp .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}.mp button:disabled{opacity:.5;cursor:default}
    .mp [hidden]{display:none!important}
    .mp .map{position:relative}.mp .fcap{position:absolute;left:10px;bottom:34px;max-width:70%;background:rgba(23,32,29,.86);color:#fff;padding:6px 10px;border-radius:8px;font-size:14px;z-index:6}
    .mp .fskip{position:absolute;left:10px;top:84px;z-index:6}
    .mp .legend{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:11px;color:#58635d}.mp .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;vertical-align:-1px}.mp .legend span{cursor:help}.mp .fix{display:grid;gap:3px;margin-top:4px}.mp .fix button{text-align:left}.mp details summary{cursor:pointer;font-size:12px;color:#58635d}
    .mp .hits{display:grid;gap:4px}.mp .hits button{text-align:left}.mp .say{border-left:4px solid #0f6b5c;padding:3px 6px;background:#f3f7f4;font-size:13px}.mp .say.bad{border-color:#c0392b;background:#fbeeee}
    .mp .how{background:#fff;border:1px solid #cfd8d1;border-radius:12px;padding:10px 12px;display:grid;gap:6px}.mp .how h2{margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#58635d;display:flex;justify-content:space-between;align-items:center}
    .mp .how ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}.mp .how li{display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:start;padding:5px 6px;border-radius:8px;color:#58635d}
    .mp .how li b.n{width:22px;height:22px;border-radius:50%;background:#dfe5e0;color:#58635d;display:grid;place-items:center;font-size:12px}.mp .how li.now{background:#e7f3ee;color:#17201d}.mp .how li.now b.n{background:#0f6b5c;color:#fff}.mp .how li.done b.n{background:#8fd3a8;color:#17201d}
    .mp .how li span.t{font-weight:700;display:block}.mp .how li span.d{font-size:12px}.mp .how button{padding:1px 8px;font-size:12px}
    .mp #slicer{background:#fff;border:1px solid #cfd8d1;border-radius:12px;padding:10px 12px}.mp #slicer:not([hidden]){display:grid;gap:8px}
    @media(max-width:700px){.mp{grid-template-columns:minmax(0,1fr) 220px}}`;
  document.head.appendChild(style);
  const root = document.createElement('div'); root.className = 'mp'; host.appendChild(root);
  const mapEl = document.createElement('div'); mapEl.className = 'map'; mapEl.id = 'map'; root.appendChild(mapEl);
  const side = document.createElement('div'); side.className = 'side'; root.appendChild(side);
  const HOW = q.get('slicehow') !== '0'; // first-timer steps; ?slicehow=0 hides them
  const S2 = q.get('slice2') !== 'old'; // CC-201 and the slicer fixes after it: ?slice2=old keeps the screen as it was
  side.innerHTML = `${S2 ? '<button id="backcourses" type="button" title="Open the list of courses" style="width:calc(100% - 104px)">← Back to courses</button>' : ''}<h1>World Slicer: pick a place</h1>
    ${HOW ? `<div id="how" class="how"><h2><span>How it works</span><button id="howhide" type="button" title="Hide these steps">Got it</button></h2><ol>
      <li data-step="1"><b class="n">1</b><div><span class="t">Slice this place</span><span class="d">Search or click the map to pick a place, then press Slice.</span></div></li>
      <li data-step="2"><b class="n">2</b><div><span class="t">Find a solid green path</span><span class="d">Click a height with a green square. The green line on the map is the lane a runner can use.</span></div></li>
      <li data-step="3"><b class="n">3</b><div><span class="t">Send to the World Editor</span><span class="d">Press the green button at the bottom. Your buildings and lane open there.</span></div></li></ol></div><button id="howshow" type="button" hidden>How it works</button>` : ''}
    <form id="searchform" class="hits"><input type="search" id="search" placeholder="Search for a place" aria-label="Search for a place"><button id="searchgo" type="submit">Search</button></form>
    <div id="hits" class="hits"></div>
    <div class="muted">Or click the map to drop a pin.</div>
    <label><span>Radius: <b id="radiusv">120</b> m</span><input type="range" id="radius" min="80" max="250" step="10" value="120"></label>
    <label><span>Shrink: <b id="shrinkv">0.2</b> (1 = real size)</span><input type="range" id="shrink" min="0.02" max="1" step="0.01" value="0.2"></label>
    ${S2 ? '' : `<label style="grid-auto-flow:column;justify-content:start;gap:6px;align-items:center"><input type="checkbox" id="hills"${q.get('hills') === '0' ? '' : ' checked'}><span>Real hills (ground height from satellite maps)</span></label>
    <label style="grid-auto-flow:column;justify-content:start;gap:6px;align-items:center"><input type="checkbox" id="useready" checked><span>Use a ready place when one is near (loads at once)</span></label>`}
    <div class="muted">Real buildings are 15 to 40 m tall and a runner jumps under 1 m up, so the place is shrunk.</div>
    ${S2 ? `<label title="Tilt the camera from straight down (0) to a side view along the ground (88). Right-drag on the map does the same."><span>Tilt: <b id="tiltv">0</b>° <span class="muted">(0 = from above, 88 = along the ground; right-drag too)</span></span><input type="range" id="tilt" min="0" max="88" step="1" value="0" aria-label="Tilt"></label>` : ''}
    <div id="mapphotos"></div>
    <button id="build" class="go" disabled>Build this place</button>
    <button id="slice" disabled>Slice this place</button>
    <div id="slicer" hidden>
      <b>World Slicer</b>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:6px 0">
        <input type="range" id="cut" min="0" max="40" step="0.5" value="10" aria-label="Cut height" title="${W('Drag to cut the place at another height', 'Drag to cut the place at another height. The runner starts the lane at this height.')}" style="writing-mode:vertical-lr;direction:rtl;height:170px;width:28px">
        <div style="display:grid;gap:6px"><div>${W('Cut height: <b id="cutv">0</b> m', 'Cut height: <b id="cutv">0</b> m')}</div><div class="muted">${W('where the lane starts', 'metres above the lowest ground, real size')}</div><button id="ladder" type="button">${W('Height lines', 'Contour ladder')}</button></div>
      </div>
      ${S2 ? `<div id="cutsay" class="say" style="display:grid;grid-template-columns:1fr 96px;gap:6px;align-items:center"><span>The runner starts on the cut height. Taller things stand up from it as walls, so a higher cut makes walls shorter. Anything lower than about <b id="dropm">?</b> m below the cut is gone, and that leaves a gap.</span>
        <svg viewBox="0 0 96 72" width="96" height="72" role="img" aria-label="Side view: a dashed cut line across three buildings. The parts above the line stay, the parts far below it are gone."><rect x="0" y="0" width="96" height="72" fill="#f3f7f4"/><rect x="6" y="30" width="18" height="38" fill="#8f9c94"/><rect x="6" y="14" width="18" height="16" fill="#8f9c94" opacity=".25"/><rect x="40" y="46" width="16" height="22" fill="#8f9c94" opacity=".35"/><rect x="72" y="22" width="18" height="46" fill="#8f9c94"/><rect x="72" y="8" width="18" height="14" fill="#8f9c94" opacity=".25"/><line x1="0" y1="40" x2="96" y2="40" stroke="#0f6b5c" stroke-width="2" stroke-dasharray="4 3"/><text x="28" y="36" font-size="8" fill="#0f6b5c">cut</text><text x="28" y="62" font-size="8" fill="#58635d">gap</text><text x="4" y="10" font-size="7" fill="#58635d">wall above</text></svg></div>` : ''}
      ${S2 ? `<div id="linenote" class="say"><span id="linenotetext"></span> <button id="linereset" type="button" hidden>Reset the line</button> <button id="snapbest" type="button" hidden title="Go back to the height and line the simulator found ahead of time">Snap to the best line</button> <button id="linefit" type="button">Show the whole line</button></div>` : ''}
      <div id="sliceread" class="say">${W('Press Slice.', 'Pick a place, press Slice.')}</div>
      <div id="slicewhy" class="muted" style="white-space:pre-line"></div>
      <div class="muted" id="stripcap" hidden>${S2 ? 'Heights (green = the simulator found a path):' : W('Try a height:', 'Heights to try: green looks crossable, amber has a gap or wall in the way, red has no lane. Click one.')}</div>
      <div id="cutstrip" style="display:flex;gap:2px;flex-wrap:wrap"></div>
      <div id="slicelegend" class="legend" ${OLD ? 'hidden' : ''}>
        <span title="The lane the runner takes. Dashed: the simulator is still checking it."><i style="background:#0f6b5c"></i>lane (dashed: checking)</span>
        <span title="Where the ground is exactly this high. Off until you tick 'Show the ground line'."><i style="background:#d35400"></i>ground at this height (optional)</span>
        <span title="Buildings the cut goes through: you see their floor plan."><i style="background:#e8622c"></i>cut buildings</span>
        <span title="The part of a building above the cut."><i style="background:#c9cfcb"></i>above the cut</span>
        ${S2 ? `<span title="A height where the simulator ran a runner along the lane and it got through."><i style="background:#8fd3a8"></i>path found</span>
        <span title="The simulator is still checking this height."><i style="background:#e9ece9;border:1px dashed #7a847e"></i>checking</span>
        <span title="The simulator found no path at this height."><i style="background:#e6c4c0"></i>no path</span>` : `<span title="Heights to try. Shape only, the simulator has not checked them."><i style="background:#cfe8d8"></i>can jump this</span>
        <span title="A gap too wide or a wall too tall on the best line."><i style="background:#f3d9a8"></i>gap or wall in the way</span>
        <span title="No line a runner could use."><i style="background:#e6c4c0"></i>no lane</span>`}
        <span title="Tint under the map: green is flat, red is steep."><i style="background:linear-gradient(90deg,#7fbf7b,#f1e27a,#e8622c,#a50f15)"></i>ground: flat to steep</span>
      </div>
      ${S2 ? '<label style="grid-auto-flow:column;justify-content:start;gap:6px;align-items:center" title="The orange curvy line is where the real ground is exactly as high as the cut. It is only a guide, so it is off until you want it."><input type="checkbox" id="showground"><span>Show the ground line (where the ground is as high as the cut)</span></label>' : ''}
      <b>${W('Buildings', 'Pick the buildings')}</b>
      <div id="pickcount" class="muted"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button id="pickall" type="button">${W('All', 'Pick all')}</button><button id="pickclear" type="button">Clear</button></div>
      <button id="buildpieces" class="go" type="button">${W('Send to the World Editor', 'Build the picked buildings')}</button>
      <details id="slicemore" ${OLD ? 'open' : ''}><summary>${W('More', 'Details')}</summary>
        <div class="muted" id="tourhelp">${W('The green line is the best lane at this height. Drag its white dots to turn or move it.', 'The green line is the best of 18 turns and up to 15 sideways steps at this height: the simulator tries the ones with the most different things on them first (a gap, a step, a curve, a wall) and keeps the first it can clear. Drag the white dots to turn it or move it: the dot in the middle moves the whole line.')}</div>
        <button id="tourreset" type="button" hidden>${W('Back to the suggested line', 'Back to the suggested line')}</button>
        <div id="scalewords" class="say"></div>
        <div class="muted">${W('Click a building to leave it out or put it back. Shift and drag picks a box (Alt removes).', 'Click a building to leave it out or put it back. Hold Shift and drag to pick a box (Alt takes buildings out).')}</div>
        ${OLD ? '<div class="muted">Orange line: the ground at this height. Orange blocks: buildings the cut goes through (their floor plan). Faded: above the cut. Green line: the lane the Course would use at this height. Tint under the map: red is steep.</div>' : ''}
      </details>
    </div>
    <div id="say" class="say">No pin yet.</div>
    <div class="muted">Map: OpenFreeMap. Search: Nominatim. Buildings: Overpass. Data © OpenStreetMap contributors (ODbL). ${TERRAIN_ATTRIBUTION}.</div>`;
  const $ = <T extends HTMLElement>(id: string) => side.querySelector('#' + id) as T;
  side.querySelector<HTMLButtonElement>('#backcourses')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('#courses-btn')?.click()); // the Courses gallery that main.ts mounts
  const radius = $<HTMLInputElement>('radius'), shrink = $<HTMLInputElement>('shrink'), build = $<HTMLButtonElement>('build'), say = $('say'), hits = $('hits');
  const flightcap = document.createElement('div'); flightcap.className = 'fcap'; flightcap.hidden = true; mapEl.appendChild(flightcap);
  const flightskip = document.createElement('button'); flightskip.className = 'fskip'; flightskip.textContent = 'Skip the flight'; flightskip.hidden = true; mapEl.appendChild(flightskip);
  const sliceBtn = $<HTMLButtonElement>('slice'), slicer = $('slicer'), cut = $<HTMLInputElement>('cut'), read = $('sliceread');
  if (HOW) { // the three first-timer steps: the current one lights up as the player goes
    const KEY = 'cc.slicerhow.hidden', how = $('how'), show = $<HTMLButtonElement>('howshow');
    let touched = false;
    const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* steps still work */ } } };
    const paint = () => { const step = slicer.hidden ? 1 : touched ? 3 : 2; how.querySelectorAll<HTMLElement>('li').forEach((li) => { const n = Number(li.dataset.step); li.classList.toggle('now', n === step); li.classList.toggle('done', n < step); }); };
    const vis = (on: boolean) => { how.hidden = !on; show.hidden = on; };
    vis(store.get() !== '1');
    $('howhide').onclick = () => { store.set('1'); vis(false); };
    show.onclick = () => { store.set('0'); vis(true); };
    new MutationObserver(paint).observe(slicer, { attributes: true, attributeFilter: ['hidden'] });
    side.querySelector('#cutstrip')!.addEventListener('click', () => { touched = true; paint(); });
    cut.addEventListener('input', () => { touched = true; paint(); });
    paint();
  }
  const tell = (s: string, bad = false) => { say.textContent = s; say.classList.toggle('bad', bad); };
  radius.oninput = () => { $('radiusv').textContent = radius.value; };
  radius.onchange = () => places?.prefetch();
  shrink.oninput = () => { $('shrinkv').textContent = shrink.value; };

  const map = new maplibregl.Map({ container: mapEl, style: STYLE, center: [Number(q.get('lon') ?? 2.1649), Number(q.get('lat') ?? 41.3917)], zoom: Number(q.get('z') ?? 15), maxPitch: S2 ? 88 : 60, attributionControl: false, canvasContextAttributes: { preserveDrawingBuffer: true } });
  const perf = createPerf({ label: 'Map', backend: 'webgl2 (MapLibre)', onDemand: true });
  map.on('render', () => perf.frame());
  map.addControl(new maplibregl.AttributionControl({ customAttribution: ['© OpenStreetMap contributors', 'OpenFreeMap'], compact: false }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  if (S2) { // CC-206: the camera can tilt from straight down to a side view along the ground; wheel and pan are the map's own and keep working
    const tilt = side.querySelector<HTMLInputElement>('#tilt')!, tv = side.querySelector('#tiltv')!;
    const showTilt = () => { const p = Math.round(map.getPitch()); tilt.value = String(p); tv.textContent = String(p); document.documentElement.dataset.mapPitch = String(p); };
    tilt.oninput = () => map.setPitch(Number(tilt.value));
    map.on('pitch', showTilt); showTilt();
  }
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
    map, side, tell, pin: () => pin, radius: () => Number(radius.value), hills: () => (S2 ? q.get('hills') !== '0' : $<HTMLInputElement>('hills').checked), strict: S2,
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
      if (!S2) storePiece(m, name); // CC-211: the editor gets the place only after the simulator has proved a lane on it
      const lane0 = setLane;
      const laneOut = S2 ? (l: PlaceLane | null) => { if (l?.cleared) { storePiece(osmToMesh(o.answer, o.lat, o.lon, l.shrink, o.ground), name); lane0(l); } else sessionStorage.removeItem(PIECE_KEY); } : lane0;
      tell(`Built ${m.buildings} buildings${o.ground ? `, on a hill of ${Math.round(relief(o.ground))} m (${m.relief.toFixed(1)} m once shrunk)` : ''}. Open it in the World Editor, or look at how the pin became a course below.`);
      document.documentElement.dataset.hill = o.ground ? String(Math.round(relief(o.ground))) : '0';
      places.finish(o, m, k0, (k) => { setShrink(k); const m2 = osmToMesh(o.answer, o.lat, o.lon, k, o.ground); if (!S2) storePiece(m2, name); return m2; }, laneOut);
    } catch (e) { tell((e as Error).message, true); }
    build.disabled = false;
  };
  // ---- the Slicer (CC-73, Atlas CC-72): a cut height slider; contours, floor plans and the lane at that height
  interface SliceState { picked: Set<number>; answer: OverpassAnswer; lat: number; lon: number; r: number; k: number; ground: Ground | null; fine: Ground | null; tops: ReturnType<typeof buildingTops>; mesh: { positions: number[]; indices: number[] }; pieces: MapPiece[]; range: number }
  let S: SliceState | null = null, sliceWorker: Worker | null = null, laneToken = 0, laneTimer = 0, layersReady = false;
  const laneCache = new Map<string, { quick: LaneSummary | null; proved: LaneSummary | null | undefined }>();
  // CC-90: a prepared place opens on a line and a height the real simulator already proved (public/assets/places/slicer-defaults.json), so 'Can clear' shows at once
  let placeSlug: string | null = null, street: StreetPanel | null = null; // CC-90: the Street photos panel follows the line
  let DEF: { d: SlicerDefault; ok: boolean } | null = null, defaultsFile: Promise<Map<string, SlicerDefault>> | null = null, verifyWorker: Worker | null = null;
  const loadDefaults = () => (defaultsFile ??= fetch('/assets/places/slicer-defaults.json').then((r) => (r.ok ? r.json() : { places: [] })).then((j: DefaultsFile) => new Map(j.places.map((d) => [d.slug, d]))).catch(() => new Map<string, SlicerDefault>()));
  let autoOn = false, programmatic = false; // autoOn: a place with no stored default keeps looking for a clearable height by itself until the person touches something
  // The shrink slider moves in steps of 0.01, but a proved default can sit between two steps (0.283): keep the exact number while the slider still shows its rounding.
  let exactK: number | null = null;
  const kNow = (): number => (exactK !== null && Number(shrink.value) === Math.round(exactK * 100) / 100 ? exactK : Number(shrink.value));
  const atDefault = (): boolean => !!DEF && !!S && !!tour && S.k === DEF.d.shrink && Number(cut.value) === DEF.d.cutM && S.picked.size === S.tops.length && sameLine([tour[0][0], tour[0][1], tour[1][0], tour[1][1]], DEF.d.line);
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
    add({ id: 'sl-contour', type: 'line', source: 'sl-contour', layout: { visibility: S2 ? 'none' : 'visible' }, paint: { 'line-color': '#d35400', 'line-width': 3.5 } });
    add({ id: 'sl-ladder', type: 'line', source: 'sl-ladder', layout: { visibility: 'none' }, paint: { 'line-color': '#7a5230', 'line-width': 1.3, 'line-opacity': 0.85 } });
    add({ id: 'sl-lane-dash', type: 'line', source: 'sl-lane', layout: { visibility: 'none' }, paint: { 'line-color': '#0f6b5c', 'line-width': 6, 'line-dasharray': [1.4, 1.2] } });
    add({ id: 'sl-lane', type: 'line', source: 'sl-lane', layout: { visibility: 'none' }, paint: { 'line-color': '#0f6b5c', 'line-width': 6 } });
    // the map style draws its own grey 3D buildings; hide them so only the buildings the game builds are cut
    for (const l of map.getStyle().layers) if (l.type === 'fill-extrusion' && !l.id.startsWith('sl-')) map.setLayoutProperty(l.id, 'visibility', 'none');
    layersReady = true;
  }

  side.querySelector<HTMLInputElement>('#showground')?.addEventListener('change', (e) => { if (layersReady) map.setLayoutProperty('sl-contour', 'visibility', (e.target as HTMLInputElement).checked ? 'visible' : 'none'); });
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

  const autoProgress = (): string | null => { if (!strip) return 'I am trying the other heights for you.'; const n = strip.cells.length, done = strip.cells.filter((x) => x.path !== undefined).length; return done < n ? `I am trying the other heights for you: ${done} of ${n} checked so far.` : null; };
  function drawLane(l: LaneSummary | null, proved: boolean) {
    const has = !!l && !!S;
    if (has) src('sl-lane').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: laneLine(l!, S!.k).map(([x, z]) => ll(x, z)) } } as never);
    map.setLayoutProperty('sl-lane-dash', 'visibility', has && !proved ? 'visible' : 'none');
    map.setLayoutProperty('sl-lane', 'visibility', has && proved ? 'visible' : 'none');
    if (!tour) placeHandles(has ? (laneLine(l!, S!.k) as [[number, number], [number, number]]) : null);
    else placeHandles(tour);
  }

  // CC-243: the Simulator speaks here too, at the top of the slicer panel, and follows the lane as the cut height or the line changes
  const simSays = simSaysPanel('slicer');
  if (simSays) { simSays.el.hidden = true; side.prepend(simSays.el); const w = slicerWords('idle'); simSays.set(w.state, w.words); } // first in the side panel, which scrolls: the strip sticks to its top once a lane is read
  let shownLane: { c: number; l: LaneSummary; proved: boolean } | null = null; // the lane on the screen: this is the one the editor gets
  function showLane(c: number, quick: LaneSummary | null, proved: LaneSummary | null | undefined) {
    shownLane = proved ? { c, l: proved, proved: true } : quick ? { c, l: quick, proved: false } : null;
    const head = OLD ? `Cut at ${num1(c)} m: ` : `${num1(c)} m: `;
    if (proved) { drawLane(proved, true); read.textContent = OLD ? `${head}the lane is ${Math.round(proved.length)} m long in the game, clearable.` : `${head}${Math.round(proved.length)} m lane, a path exists.`; dset('sliceLane', 'clearable'); dset('sliceLaneLength', Math.round(proved.length)); }
    else if (proved === null && quick) { drawLane(quick, false); read.textContent = OLD ? `${head}a lane of ${Math.round(quick.length)} m, but the simulator could not clear it.` : `${head}${Math.round(quick.length)} m lane, but no path found.`; dset('sliceLane', 'not-clearable'); }
    else if (proved === null) { drawLane(null, false); read.textContent = OLD ? `${head}no lane here (too short, too steep, or nothing to run on).` : `${head}no lane here.`; dset('sliceLane', 'none'); }
    else if (quick) { drawLane(quick, false); read.textContent = OLD ? `${head}a lane of ${Math.round(quick.length)} m; checking that it can be cleared…` : `${head}${Math.round(quick.length)} m lane, checking…`; dset('sliceLane', 'checking'); }
    else { drawLane(null, false); read.textContent = OLD ? `${head}looking for a lane…` : `${head}looking…`; dset('sliceLane', 'working'); }
    const onBest = atDefault();
    dset('sliceLaneProven', proved && onBest && DEF?.ok ? '1' : '0');
    if (simSays) { simSays.el.hidden = false; const w = slicerWords(document.documentElement.dataset.sliceLane ?? '', Math.round((proved ?? quick)?.length ?? 0), num1(c), { proven: proved && onBest && !!DEF?.ok ? true : false, closest: onBest && !!DEF && !DEF.ok, auto: autoOn ? autoProgress() : null }); simSays.set(w.state, w.words); }
    updateLineNote();
    lastLane = { c, quick, proved };
    showWhy(c, quick, proved);
    if (proved !== undefined) askStrip();
  }

  // ---- CC-92: why a height fails, and a strip of heights to try
  type StripCell = StripRow & { real: number; path?: boolean }; // path (CC-202): true/false once the simulator proof has answered for this height, undefined while it is still checking
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
      if (S2) { // CC-202: green only when the simulator has found a path at this height, for the picked buildings and the line on the screen
        b.title = x.path === undefined ? `Cut at ${x.real} m: checking with the simulator...` : x.path ? `Cut at ${x.real} m: a path was found here. Click to go there.` : `Cut at ${x.real} m: the simulator found no path here.`;
        b.style.cssText = `padding:2px 6px;font:600 12px system-ui,sans-serif;border:1px solid #17201d33;border-radius:6px;cursor:pointer;background:${x.path === undefined ? '#e9ece9;color:#7a847e;border-style:dashed' : x.path ? '#8fd3a8' : '#e6c4c0'}`;
        b.dataset.state = x.path === undefined ? 'checking' : x.path ? 'path' : 'none';
      } else
      b.style.cssText = `padding:2px 6px;font:600 12px system-ui,sans-serif;border:1px solid #17201d33;border-radius:6px;cursor:pointer;background:${x.crossable ? '#cfe8d8' : x.lane ? '#f3d9a8' : '#e6c4c0'}`;
      b.onclick = () => { cut.value = String(x.real); cut.dispatchEvent(new Event('input')); cut.dispatchEvent(new Event('change')); };
      stripEl.append(b);
    }
    dset('sliceStrip', JSON.stringify(strip.cells.map((x) => [x.real, S2 ? (x.path === undefined ? 'checking' : x.path ? 'ok' : 'none') : x.lane ? (x.crossable ? 'ok' : 'blocked') : 'none'])));
  }
  const ownKey = () => (tour ? `|${tour.map((p) => p.map((v) => Math.round(v)).join(',')).join(';')}` : '');
  let proofWorker: Worker | null = null;
  // CC-202: after the shape pass, the simulator proves each height that has a lane; the nearest heights first
  function proveStrip(my: number) {
    if (!S || !strip) return;
    proofWorker?.terminate(); proofWorker = null;
    const cells = strip.cells, todo = cells.map((c, i) => i).filter((i) => cells[i].lane).sort((a, b) => Math.abs(cells[a].real - Number(cut.value)) - Math.abs(cells[b].real - Number(cut.value)));
    for (const c of cells) c.path = c.lane ? undefined : false;
    if (!todo.length) { settleStrip(); return; }
    try { proofWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { return; }
    let left = todo.length;
    proofWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.phase !== 'proof' || a.id !== my || my !== stripToken || !strip) return;
      strip.cells[todo[a.i]].path = a.path; drawStrip();
      if (autoOn && a.path && document.documentElement.dataset.sliceLane !== 'clearable') { autoOn = false; dset('sliceAuto', 'found'); hopTo(strip.cells[todo[a.i]].real); } // the best height so far, nearest first, found without being asked
      else if (autoOn && lastLane) showLane(lastLane.c, lastLane.quick, lastLane.proved);
      if (--left === 0) { proofWorker?.terminate(); proofWorker = null; settleStrip(); }
    };
    proofWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, pieces: S.pieces, level: 0, prove: todo.map((i) => cells[i].real * S!.k), ...(tour ? { custom: customOf(tour, S.k) } : {}) } satisfies SliceAsk);
  }
  const settleStrip = () => { drawStrip(); dset('sliceStripDone', '1'); if (lastLane) showWhy(lastLane.c, lastLane.quick, lastLane.proved); };
  function askStrip() {
    if (!S) return;
    const key = `${S.k}|${[...S.picked].sort((a, b) => a - b).join('.')}|${S.r}${S2 ? ownKey() : ''}`;
    if (strip?.key === key) return;
    const my = ++stripToken; stripWorker?.terminate(); stripWorker = null; proofWorker?.terminate(); proofWorker = null; dset('sliceStripDone', '');
    const reals = Array.from({ length: 10 }, (_, i) => Math.max(0.5, Math.round((S!.range * (i + 0.5)) / 10 * 2) / 2));
    if (S2 && tour) { // the check runs on the player's own line, so the shape pass (which looks for the best line) says nothing: go straight to the proof
      strip = { key, cells: reals.map((real) => ({ level: 0, lane: true, real })) }; drawStrip(); proveStrip(my); return;
    }
    try { stripWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { return; }
    stripWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.id !== my || a.phase !== 'strip') return;
      strip = { key, cells: a.rows.map((r, i) => ({ ...r, real: reals[i] })) }; stripWorker?.terminate(); stripWorker = null;
      if (S2) { drawStrip(); proveStrip(my); return; }
      drawStrip(); if (lastLane) showWhy(lastLane.c, lastLane.quick, lastLane.proved);
    };
    stripWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, level: 0, strip: reals.map((c) => c * S!.k) } satisfies SliceAsk);
  }
  const setCut = (v: number) => { cut.value = String(v); cut.dispatchEvent(new Event('input')); cut.dispatchEvent(new Event('change')); };
  const hopTo = (v: number) => { programmatic = true; try { setCut(v); } finally { programmatic = false; } };
  function runSuggestion(a: Suggestion['action']) {
    if (a.kind === 'cut') setCut(a.value);
    else if (a.kind === 'shrink') { shrink.value = String(a.value); $('shrinkv').textContent = String(a.value); shrink.dispatchEvent(new Event('change')); }
    else if (a.kind === 'pickall') $('pickall').click();
  }
  // CC-179: one plain reason and up to three ranked fixes from built-in rules (src/slice/suggest.ts), no language model
  let fixToken = 0, fixWorker: Worker | null = null;
  function showWhyNew(c: number, quick: LaneSummary | null) {
    if (!S) return;
    const a = explainNoPath({ facts: quick?.facts ?? null, k: S.k, cut: c, strip: (strip?.cells ?? []).map((x) => ({ real: x.real, lane: x.lane, crossable: S2 ? x.path === true : x.crossable })), picked: S.picked.size, total: S.tops.length, proven: S2 });
    const reason = document.createElement('div'); reason.className = 'say bad'; reason.textContent = a.reason.replace(/ No cut or shrink helps here, pick another place\.$/, ''); whyEl.append(reason);
    const box = document.createElement('div'); box.className = 'fix';
    const addButton = (sg: Suggestion, n: number) => {
      const row = document.createElement('div');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sugg'; b.textContent = `${n}. ${sg.text}`;
      b.title = S2 ? 'The simulator found a path with this change. Click to do it.' : 'Click: change it and check again'; b.onclick = () => runSuggestion(sg.action); row.append(b); box.append(row);
    };
    if (!S2) {
      if (a.suggestions.length) {
        const h = document.createElement('div'); h.textContent = 'Try one of these:'; box.append(h);
        a.suggestions.forEach((sg, n) => { const row = document.createElement('div'); if (sg.action.kind === 'drag') row.textContent = `${n + 1}. ${sg.text}`; else addButton(sg, n + 1); if (sg.action.kind === 'drag') box.append(row); });
        whyEl.append(box);
      }
    } else {
      // CC-202: a fix is shown only when the simulator has found a path with it, for the same picked buildings and the same line
      const stripBusy = !!strip && strip.cells.some((x) => x.path === undefined);
      const cands = a.suggestions.filter((sg) => sg.action.kind === 'shrink' || sg.action.kind === 'pickall');
      const proven: Suggestion[] = a.suggestions.filter((sg) => sg.action.kind === 'cut'); // from the proven strip
      const note = document.createElement('div'); note.className = 'muted'; note.id = 'fixnote';
      const show = (list: Suggestion[], pending: number) => {
        box.replaceChildren(); list.forEach((sg, n) => addButton(sg, n + 1));
        note.textContent = pending ? `Checking ${pending} possible fix${pending > 1 ? 'es' : ''} with the simulator...` : list.length ? '' : (stripBusy ? 'Checking the heights with the simulator...' : 'I tried the other heights and the changes I know of: none gives a path with these buildings and this line. Pick another place, or turn the line.');
        box.prepend(note);
        dset('sliceFixesShown', list.length); dset('sliceFixesPending', pending);
        dset('sliceFixes', JSON.stringify(list.map((x) => x.action)));
      };
      whyEl.append(box); show(proven, cands.length);
      const my = ++fixToken; fixWorker?.terminate(); fixWorker = null;
      if (cands.length) {
        try { fixWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { show(proven, 0); }
        let left = cands.length; const ok: Suggestion[] = [];
        if (fixWorker) {
          fixWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
            const r = e.data; if (r.phase !== 'proof' || my !== fixToken) return;
            const sg = cands[r.id - my * 100]; if (r.path) ok.push(sg);
            left--; show([...proven, ...ok].slice(0, 3), left);
            if (!left) { fixWorker?.terminate(); fixWorker = null; }
          };
          cands.forEach((sg, n) => {
            const k2 = sg.action.kind === 'shrink' ? sg.action.value : S!.k, picked2 = sg.action.kind === 'pickall' ? new Set(S!.tops.keys()) : S!.picked;
            const st = stateAt(k2, picked2), cut2 = Math.min(c, st.range);
            fixWorker!.postMessage({ id: my * 100 + n, positions: st.mesh.positions, indices: st.mesh.indices, pieces: st.pieces, level: 0, prove: [cut2 * k2], ...(tour ? { custom: customOf(tour, k2) } : {}) } satisfies SliceAsk);
          });
        }
      }
      dset('sliceWhy', a.reason); dset('sliceWhyKind', a.kind);
      return;
    }
    dset('sliceWhy', a.reason); dset('sliceWhyKind', a.kind); dset('sliceFixes', JSON.stringify(a.suggestions.map((x) => x.action)));
  }
  function showWhy(c: number, quick: LaneSummary | null, proved: LaneSummary | null | undefined) {
    whyEl.replaceChildren();
    if (proved !== null) return; // cleared, or still working
    if (DEF && !atDefault()) { // a tweaker is never stuck: one press goes back to the proven line
      const b = document.createElement('button'); b.type = 'button'; b.id = 'snapbest2'; b.className = 'go'; b.textContent = 'Snap to the best line'; b.title = 'Go back to the height and line the simulator found ahead of time'; b.style.cssText = 'display:block;margin:4px 0'; b.onclick = snapToBest; whyEl.append(b);
    }
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
  const customOf = (t: [[number, number], [number, number]], k: number = S!.k) => customOfK(t, k); // the lane lives in the shrunk place: real metres times the shrink (shared with the offline search, CC-90)
  const tourReset = $<HTMLButtonElement>('tourreset');
  // CC-203: say which dot changes what, and that every check runs on the line on the screen
  const lineNote = side.querySelector<HTMLElement>('#linenotetext'), lineReset = side.querySelector<HTMLButtonElement>('#linereset');
  const NOTE_AUTO = 'The green line is the best line the check found. Turn it by dragging a round dot at either end; move it all by dragging the square in the middle.';
  const NOTE_OWN = 'This is your line, not the best one. Every check here (path, heights, fixes) now uses your line. Moving a dot checks it again.';
  const NOTE_DEFAULT = 'This is the best line for this place, found by the simulator ahead of time. A ghost ran it on the real physics and cleared it. The World Editor gets this same line and height.';
  const NOTE_CLOSEST = 'No clean line was found here. This is the closest one the search got. You can still move it and try.';
  const snapBtn = side.querySelector<HTMLButtonElement>('#snapbest');
  if (snapBtn) snapBtn.onclick = snapToBest;
  function refreshStreet() {
    if (!S2 || !streetPhotosOn(pageQuery())) return;
    if (!street) street = mountStreetPanel(side.querySelector('#linenote')!.parentElement!);
    const line: [number, number, number, number] | null = tour ? [tour[0][0], tour[0][1], tour[1][0], tour[1][1]] : DEF ? DEF.d.line : null;
    street.update(placeSlug, line);
  }
  function updateLineNote(dragging = false) {
    if (!lineNote || !lineReset) return;
    const onBest = atDefault();
    lineNote.textContent = dragging ? 'Moving the line... it is checked again when you let go.' : onBest ? (DEF!.ok ? NOTE_DEFAULT : NOTE_CLOSEST) : tour ? NOTE_OWN : NOTE_AUTO;
    lineReset.hidden = !tour || !!DEF; dset('lineMode', onBest ? 'best' : tour ? 'own' : 'auto');
    if (snapBtn) snapBtn.hidden = !DEF || onBest || dragging;
    if (!dragging) refreshStreet();
  }
  if (lineReset) lineReset.onclick = () => tourReset.click();
  // CC-204: a dot that sits outside the picture cannot be grabbed (the owner found "only two dots drag"; in the real run two of the three were off the screen).
  // Pull back and centre on the line until all three dots are inside the picture.
  function showWholeLine() {
    if (handles.length < 3) return;
    const cv = map.getCanvas(), W = cv.clientWidth, H = cv.clientHeight, m = 36;
    const inside = () => handles.every((h) => { const p = map.project(h.getLngLat()); return p.x >= m && p.x <= W - m && p.y >= m && p.y <= H - m; });
    for (let n = 0; n < 12 && !inside(); n++) map.jumpTo({ center: handles[2].getLngLat(), zoom: map.getZoom() - 0.35 });
    dset('dotsInView', inside() ? '1' : '0');
  }
  side.querySelector<HTMLButtonElement>('#linefit')?.addEventListener('click', showWholeLine);
  updateLineNote();
  function previewLine(a: [number, number], b: [number, number]) {
    src('sl-lane').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [ll(a[0], a[1]), ll(b[0], b[1])] } } as never);
    map.setLayoutProperty('sl-lane-dash', 'visibility', 'visible'); map.setLayoutProperty('sl-lane', 'visibility', 'none');
  }
  function commitTour() {
    if (!S || handles.length < 3) return;
    const a = handleAt(0), b = handleAt(1);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) { tell('Drag the dots further apart: the line needs at least 4 m.', true); updateLineNote(); return; }
    autoOn = false; tour = [a, b]; tourReset.hidden = false; updateLineNote();
    dset('tourLine', JSON.stringify(tour.map((p) => p.map((v) => Math.round(v)))));
    askLane(Number(cut.value));
  }
  let handleDrag = false, onMap = false;
  function placeHandles(line: [[number, number], [number, number]] | null) {
    if (!S) return;
    if (!line) { for (const h of handles) h.remove(); onMap = false; return; }
    if (handleDrag) return; // a lane answer that arrives mid-drag must not move or re-add the dot in the player's hand
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
            handles[0].setLngLat(ll(na[0], na[1])); handles[1].setLngLat(ll(nb[0], nb[1])); previewLine(na, nb); updateLineNote(true);
          } else {
            const a = handleAt(0), b = handleAt(1);
            handles[2].setLngLat(ll((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); previewLine(a, b); updateLineNote(true);
          }
        });
        h.on('dragstart', () => { handleDrag = true; });
        h.on('dragend', () => { handleDrag = false; commitTour(); });
        handles.push(h);
      });
    }
    const [a, b] = line;
    // addTo() on a dot already on the map removes and re-adds it, which drops its drag listeners and ends a drag that has just begun (the owner's "only one end moves, the other pans the map"): add once, then only move
    [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number]].forEach((p, i) => { handles[i].setLngLat(ll(p[0], p[1])); if (!onMap) handles[i].addTo(map); });
    onMap = true;
    if (S2 && !skipFlight && !tour) showWholeLine();
  }
  tourReset.onclick = () => { if (DEF) { snapToBest(); return; } autoOn = false; tour = null; tourReset.hidden = true; dset('tourLine', ''); updateLineNote(); askLane(Number(cut.value)); };

  function askLane(c: number) {
    if (!S) return;
    const custom = tour ? customOf(tour) : undefined;
    const key = `${c}|${S.k}|${S.r}|${[...S.picked].sort((a, b) => a - b).join('.')}${custom ? `|${custom.angle.toFixed(3)},${custom.offset.toFixed(2)}` : ''}`, hit = laneCache.get(key);
    const my = ++laneToken; sliceWorker?.terminate(); sliceWorker = null;
    if (!hit && DEF?.ok && atDefault()) { const syn = provenSummary({ shrink: DEF.d.shrink, line: DEF.d.line, lengthM: DEF.d.lengthM }); laneCache.set(key, { quick: syn, proved: syn }); showLane(c, syn, syn); return; } // proved offline on the real simulator: no spinner
    if (hit && hit.proved !== undefined) { showLane(c, hit.quick, hit.proved); return; }
    showLane(c, null, undefined); dset('sliceLane', 'working');
    try { sliceWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { read.textContent = 'This browser cannot run the lane search in the background.'; return; }
    let quick: LaneSummary | null = null;
    sliceWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.id !== my || a.phase === 'strip' || a.phase === 'proof') return;
      if (a.phase === 'quick') { quick = a.lane; laneCache.set(key, { quick, proved: undefined }); showLane(c, quick, undefined); }
      else { laneCache.set(key, { quick, proved: a.lane }); showLane(c, quick, a.lane); }
    };
    sliceWorker.postMessage({ id: my, positions: S.mesh.positions, indices: S.mesh.indices, level: c * S.k, pieces: S.pieces, ...(custom ? { custom } : {}) } satisfies SliceAsk);
  }

  // the proven default is re-checked quietly; it speaks only if the live check disagrees
  function startVerify(c: number) {
    if (!S || !DEF?.ok || !tour) return;
    verifyWorker?.terminate();
    try { verifyWorker = new Worker(new URL('../slice/slicer-worker.ts', import.meta.url), { type: 'module' }); } catch { return; }
    const own = customOf(tour), k = S.k, d = DEF.d;
    verifyWorker.onmessage = (e: MessageEvent<SliceAnswer>) => {
      const a = e.data; if (a.phase !== 'proved') return;
      verifyWorker?.terminate(); verifyWorker = null; dset('sliceVerified', a.lane ? 'agrees' : 'disagrees');
      if (a.lane || !DEF || DEF.d !== d) return;
      DEF.ok = false; laneCache.clear(); askLane(Number(cut.value)); // the stored answer is out of date: say what the live check says
    };
    verifyWorker.postMessage({ id: 0, positions: S.mesh.positions, indices: S.mesh.indices, level: c * k, pieces: S.pieces, custom: own } satisfies SliceAsk);
  }
  function snapToBest() { // jump back to the proven default: shrink, height, picks and line
    if (!S || !DEF) return;
    autoOn = false;
    const d = DEF.d;
    if (S.k !== d.shrink) { exactK = d.shrink; shrink.value = String(d.shrink); $('shrinkv').textContent = String(d.shrink); rebuild(); cut.max = String(S.range); }
    S.picked = new Set(S.tops.keys()); rebuild();
    tour = tourOf(d.line); tourReset.hidden = true; dset('tourLine', JSON.stringify(tour));
    cut.value = String(d.cutM); paint(d.cutM); updateLineNote(); askLane(d.cutM);
    if (DEF.ok) startVerify(d.cutM);
  }
  const cutChanged = (instant: boolean) => {
    const c = Number(cut.value); paint(c);
    clearTimeout(laneTimer);
    if (instant) askLane(c); else laneTimer = window.setTimeout(() => askLane(c), 500);
  };
  cut.oninput = () => { if (!programmatic) autoOn = false; cutChanged(false); };
  cut.onchange = () => { if (!programmatic) autoOn = false; cutChanged(true); };

  // the place at shrink k with these buildings picked: the roofs, the mesh and the pieces (also used to prove a fix before it is offered, CC-202)
  function stateAt(k: number, picked: Set<number>) {
    const bs = buildingsFrom(S!.answer, S!.lat, S!.lon), tops = buildingTops(bs, k, S!.ground);
    const m = extrude(tops.filter((_, i) => picked.has(i)).map((t) => t.b), k, S!.ground);
    return { bs, tops, mesh: { positions: m.positions, indices: m.indices }, pieces: piecesFrom(tops, picked, k, S!.ground), range: cutRange(tops, S!.ground) };
  }
  function rebuild() { // the place at the current shrink: the roofs and the mesh the lane is cut from
    if (!S) return;
    const k = kNow(), st = stateAt(k, S.picked), bs = st.bs;
    S.k = k; S.tops = st.tops; S.mesh = st.mesh;
    S.pieces = st.pieces; // the very pieces "Send to the editor" hands over: the check reads the lane from them (CC-179)
    $('scalewords').textContent = scaleWords(S.r, k, bs.length ? bs.map((b) => b.h).sort((a, b2) => a - b2)[Math.floor(bs.length / 2)] : 9);
    S.range = st.range;
    const dm = side.querySelector('#dropm'); if (dm) dm.textContent = String(Math.round(LANE_DROP / k * 10) / 10);
  }
  shrink.onchange = () => { if (!S) return; autoOn = false; rebuild(); cut.max = String(S.range); cutChanged(true); };

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
    const q2 = pageQuery(), at = q2.get('flightat');
    const reduced = reducedMotion() || q2.get('flight') === '0';
    const end = () => {
      setWave(null); skipFlight = null; flightcap.hidden = true; flightskip.hidden = true;
      map.setLayoutProperty('sl-plane', 'visibility', 'visible'); slicer.hidden = false;
      dset('flightDone', '1'); cutChanged(true); if (S2 && !tour) showWholeLine();
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
  function picksChanged() { if (!S) return; autoOn = false; rebuild(); paint(Number(cut.value)); clearTimeout(laneTimer); laneTimer = window.setTimeout(() => askLane(Number(cut.value)), 500); }
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
    if (S2 && !(shownLane && shownLane.proved && shownLane.c === Number(cut.value))) { tell('The simulator has not found a path at this height. Pick a green height first.', true); return; } // CC-211
    if (!pieces.length) { tell('Pick at least one building first.', true); return; }
    const lane = shownLane && shownLane.c === Number(cut.value) ? { ...handoverLane(shownLane.l, shownLane.c, S.k), from: shownLane.proved ? 'slicer' : 'slicer-unproved' } : undefined;
    try { sessionStorage.setItem(PIECE_KEY, JSON.stringify({ name: 'Place', pieces, ...(lane ? { lane } : {}), camera: { heading: map.getBearing(), pitch: Math.min(map.getPitch(), 60), distance: Math.max(12, S.r * S.k * 1.8) } })); } catch { tell('That is too many buildings to hand over at once. Pick fewer.', true); return; }
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
      if (S2) { tour = null; tourReset.hidden = true; dset('tourLine', ''); updateLineNote(); } // a line dragged on another place must not follow you here (CC-203)
      const r = o.radius, answer = o.answer, ground = o.ground;
      if (!buildingsFrom(answer, pin.lat, pin.lon).length && !ground) { tell('Nothing to slice here. Move the pin and try again.', true); sliceBtn.disabled = false; return; }
      placeSlug = S2 && o.source === 'ready' && o.slug ? o.slug : null;
      exactK = null; DEF = null; verifyWorker?.terminate(); verifyWorker = null; autoOn = false;
      const stored = S2 && o.source === 'ready' && o.slug ? (await loadDefaults()).get(o.slug) : undefined;
      if (stored && (stored.clear || stored.lengthM > 0)) { exactK = stored.shrink; shrink.value = String(stored.shrink); $('shrinkv').textContent = String(stored.shrink); DEF = { d: stored, ok: stored.clear }; }
      S = { picked: new Set(), answer, lat: pin.lat, lon: pin.lon, r, k: kNow(), ground, fine: ground ? resample(ground, 4) : null, tops: [], mesh: { positions: [], indices: [] }, pieces: [], range: 0 };
      rebuild(); S.picked = new Set(S.tops.keys()); rebuild();
      if (!map.isStyleLoaded()) await new Promise<void>((res) => map.once('idle', () => res()));
      ensureLayers();
      src('sl-slope').setData({ type: 'FeatureCollection', features: ground ? slopeCells(ground).map((c) => ({ type: 'Feature', properties: { deg: c.deg }, geometry: { type: 'Polygon', coordinates: poly([[c.x0, c.z0], [c.x1, c.z0], [c.x1, c.z1], [c.x0, c.z1]]) } })) : [] } as never);
      src('sl-circle').setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [Array.from({ length: 65 }, (_, i) => ll(r * Math.cos((i / 64) * 2 * Math.PI), r * Math.sin((i / 64) * 2 * Math.PI)))] } } as never);
      cut.min = '0'; cut.max = String(S.range); cut.step = '0.5';
      const open = openingFor(DEF?.d, { shrink: S.k, range: S.range });
      cut.value = String(open.cutM);
      if (DEF && open.line) { tour = tourOf(open.line); tourReset.hidden = true; dset('tourLine', JSON.stringify(tour)); }
      autoOn = S2 && !DEF; // a custom place has no stored default: the search starts by itself and shows the best height so far
      dset('sliceDefault', DEF ? (DEF.ok ? 'proven' : 'closest') : 'none'); dset('sliceAuto', autoOn ? 'on' : 'off');
      updateLineNote();
      tell(`Sliced ${S.tops.length} buildings${ground ? `, ground ${Math.round(relief(ground))} m from the lowest to the highest point` : ' (flat ground)'}. Drag the cut height.`);
      dset('sliceReady', '1'); dset('sliceRange', S.range); dset('sliceRelief', Math.round(relief(ground)));
      const fit = Math.min(18.5, Math.log2((156543 * Math.cos((pin.lat * Math.PI) / 180) * 900) / (3 * r)));
      if (DEF) { askLane(open.cutM); startVerify(open.cutM); } // the proven answer is on the screen before the flight ends
      flyIn(fit);
    } catch (e) { tell((e as Error).message, true); }
    sliceBtn.disabled = false;
  };
  return { backend: 'webgl2' };
}
