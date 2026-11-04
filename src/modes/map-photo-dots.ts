// Photo dots on the slicer map (CC-133): where each checked street photo was taken, and a cone for the way it faced. A click shows the photo live from Mapillary.
// We store no pictures: the picture address comes from /api/photos when you click, with the maker's name and the licence beside it.
import type * as maplibregl from 'maplibre-gl';
import { DOTS_MAX, DOTS_MIN_ZOOM, dotsGeoJSON, nearest } from '../world/photo-dots';
import { LICENCE, photoPage, type AllowedPhoto, type AllowList } from '../world/live-photos';
import { resolveThumbs } from '../ui/live-photos';

/** True when the point is on a photo dot, so the map's own click (drop a pin) steps aside. */
export const onPhotoDot = (map: maplibregl.Map, pt: maplibregl.PointLike): boolean => !!map.getLayer('pd-dot') && map.queryRenderedFeatures(pt, { layers: ['pd-dot'] }).length > 0;

type Src = maplibregl.GeoJSONSource;

export function installPhotoDots(map: maplibregl.Map, f: typeof fetch = fetch): void {
  const host = map.getContainer();
  let all: AllowedPhoto[] = [], timer = 0;
  const panel = document.createElement('div');
  panel.id = 'photodotpanel'; panel.hidden = true;
  panel.style.cssText = 'position:absolute;right:10px;top:56px;z-index:7;width:300px;background:#fff;border:1px solid #b9c2bb;border-radius:8px;padding:8px;font:13px/1.35 system-ui,sans-serif;color:#17201d;box-shadow:0 2px 8px rgba(0,0,0,.25)';
  host.appendChild(panel);

  const draw = () => {
    const vis = map.getZoom() >= DOTS_MIN_ZOOM;
    for (const l of ['pd-cone', 'pd-dot']) if (map.getLayer(l)) map.moveLayer(l); // keep the dots on top of the slice layers, or the slice plane hides them from the click
    for (const l of ['pd-cone', 'pd-dot']) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', vis ? 'visible' : 'none');
    if (!vis) { host.dataset.photodots = '0'; return; }
    const c = map.getCenter(), pick = nearest(all, c.lat, c.lng, DOTS_MAX), g = dotsGeoJSON(pick);
    (map.getSource('pd-cone') as Src | undefined)?.setData(g.cones as never);
    (map.getSource('pd-dot') as Src | undefined)?.setData(g.dots as never);
    host.dataset.photodots = String(pick.length);
  };

  let shownId = '';
  async function open(id: string) {
    const a = all.find((p) => p.id === id); if (!a) return;
    shownId = id; panel.hidden = false;
    panel.textContent = 'Getting the photo from Mapillary...';
    const t = (await resolveThumbs([id], f))?.[0];
    if (shownId !== id) return;
    panel.replaceChildren();
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.id = 'photodotclose'; close.style.cssText = 'float:right'; close.onclick = () => { panel.hidden = true; shownId = ''; };
    if (!t) { panel.append(close, 'The photo service is not answering right now.'); return; }
    const img = document.createElement('img'); img.src = t.thumb; img.alt = 'A street photo from Mapillary'; img.referrerPolicy = 'no-referrer'; img.style.cssText = 'width:100%;display:block;margin:6px 0;border-radius:4px';
    const cap = document.createElement('div'); cap.className = 'muted'; cap.style.cssText = 'font-size:12px;color:#58635d';
    const year = t.capturedAt ? ` (${new Date(t.capturedAt).getUTCFullYear()})` : '';
    const by = document.createElement('span'); by.textContent = `Photo by ${t.creator || a.creator || 'a Mapillary contributor'}${year}, `;
    const lic = document.createElement('a'); lic.href = LICENCE.url; lic.target = '_blank'; lic.rel = 'noopener'; lic.textContent = LICENCE.name;
    const src = document.createElement('a'); src.href = photoPage(id); src.target = '_blank'; src.rel = 'noopener'; src.textContent = 'on Mapillary';
    cap.append(by, lic, ', ', src, '. Mapillary blurs faces and plates; use the link to report one it missed.');
    const way = document.createElement('div'); way.style.cssText = 'font-size:12px'; way.textContent = a.compass === null ? '' : 'The cone on the map points the way this photo faced.';
    panel.append(close, 'Street photo', img, cap, way);
  }

  async function load() {
    try {
      const idx = (await (await f('/assets/photos-live/index.json')).json()) as { places?: Record<string, number> };
      const got = await Promise.all(Object.keys(idx.places ?? {}).map(async (slug) => { try { return (await (await f(`/assets/photos-live/${slug}.json`)).json()) as AllowList; } catch { return null; } }));
      const seen = new Set<string>();
      for (const l of got) for (const p of l?.photos ?? []) if (!seen.has(p.id) && Number.isFinite(p.lat) && Number.isFinite(p.lon)) { seen.add(p.id); all.push(p); }
    } catch { all = []; }
    draw();
  }

  const setup = () => {
    map.addSource('pd-cone', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('pd-dot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'pd-cone', type: 'fill', source: 'pd-cone', paint: { 'fill-color': '#e8590c', 'fill-opacity': 0.35, 'fill-outline-color': '#b8430a' } });
    map.addLayer({ id: 'pd-dot', type: 'circle', source: 'pd-dot', paint: { 'circle-radius': 5, 'circle-color': '#e8590c', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.on('click', 'pd-dot', (e: maplibregl.MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id; if (id) void open(String(id)); });
    map.on('mouseenter', 'pd-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'pd-dot', () => { map.getCanvas().style.cursor = ''; });
    map.on('moveend', () => { clearTimeout(timer); timer = window.setTimeout(draw, 150); });
    void load();
  };
  if (map.isStyleLoaded()) setup(); else map.once('load', setup);
}
