// Real ground height for a place (CC-51): AWS Terrain Tiles in the Terrarium format, no key, open data.
// Pure except `fetchGround`, which needs a fetch and a PNG decoder (the browser and Node decode differently, so the caller passes one).
// Heights are metres above sea level; the grid is centred on the pin, x east, z south, like src/world/osm.ts.
export interface Ground { radius: number; step: number; n: number; h: number[] } // n x n samples, row = z, column = x

export const TERRAIN_ZOOM = 15; // about 4.8 m per pixel at the equator, 3 m in Paris
export const terrainUrl = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
export const TERRAIN_ATTRIBUTION = 'Terrain: Mapzen / AWS Terrain Tiles (SRTM, ASTER, 3DEP and others, see registry.opendata.aws/terrain-tiles)';

// Terrarium: height = R * 256 + G + B / 256 - 32768
export const terrariumHeight = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

// Web-mercator tile coordinates of a point, as floats (the integer part names the tile, the fraction is the place inside it)
export function tileXY(lat: number, lon: number, zoom = TERRAIN_ZOOM): { x: number; y: number } {
  const n = 2 ** zoom, r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

export interface Tile { data: ArrayLike<number>; width: number; channels: number } // raw pixels, 3 or 4 bytes each

// the height at a tile coordinate (nearest pixel)
export function heightAt(tile: Tile, fx: number, fy: number): number {
  const px = Math.min(tile.width - 1, Math.floor((fx % 1) * tile.width)), py = Math.min(tile.width - 1, Math.floor((fy % 1) * tile.width));
  const i = (py * tile.width + px) * tile.channels;
  return terrariumHeight(tile.data[i], tile.data[i + 1], tile.data[i + 2]);
}

export function groundAt(g: Ground | null | undefined, x: number, z: number): number {
  if (!g) return 0;
  const fi = Math.min(g.n - 1.001, Math.max(0, (x + g.radius) / g.step)), fj = Math.min(g.n - 1.001, Math.max(0, (z + g.radius) / g.step));
  const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, H = (ii: number, jj: number) => g.h[jj * g.n + ii];
  return H(i, j) * (1 - a) * (1 - b) + H(i + 1, j) * a * (1 - b) + H(i, j + 1) * (1 - a) * b + H(i + 1, j + 1) * a * b;
}

export const relief = (g: Ground | null | undefined) => (g ? Math.max(...g.h) - Math.min(...g.h) : 0);
export const lowest = (g: Ground | null | undefined) => (g ? Math.min(...g.h) : 0);

export async function fetchGround(
  lat: number, lon: number, radius: number,
  decode: (png: ArrayBuffer) => Promise<Tile>,
  opts: { step?: number; fetcher?: (url: string) => Promise<ArrayBuffer> } = {},
): Promise<Ground> {
  const step = opts.step ?? 20, n = Math.ceil((2 * radius) / step) + 1;
  const get = opts.fetcher ?? (async (url: string) => { const r = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`terrain tile: HTTP ${r.status}`); return r.arrayBuffer(); });
  const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const need = new Map<string, [number, number]>(); // which tiles the grid touches
  const at = (i: number, j: number) => tileXY(lat - (-radius + j * step) / mPerDegLat, lon + (-radius + i * step) / mPerDegLon);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = at(i, j); need.set(`${Math.floor(t.x)}/${Math.floor(t.y)}`, [Math.floor(t.x), Math.floor(t.y)]); }
  const tiles = new Map<string, Tile>();
  await Promise.all([...need].map(async ([key, [tx, ty]]) => tiles.set(key, await decode(await get(terrainUrl(TERRAIN_ZOOM, tx, ty))))));
  const h: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const t = at(i, j);
    h.push(Math.round(heightAt(tiles.get(`${Math.floor(t.x)}/${Math.floor(t.y)}`)!, t.x, t.y) * 10) / 10);
  }
  return { radius, step, n, h };
}
