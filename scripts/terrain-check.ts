// CC-51: do the AWS terrain tiles say the right height? Checks places with a known height and cross-checks all of them against Open-Meteo (Copernicus 90 m model).
// Usage: npx tsx scripts/terrain-check.ts     Writes data/eval/cc-51-terrain/{elevations,run}.json
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { fetchGround, groundAt } from '../src/world/terrain';

interface Spot { name: string; lat: number; lon: number; known?: { m: number; tol: number; source: string } }
const SPOTS: Spot[] = [
  { name: 'Montmartre, Sacre-Coeur (hilly)', lat: 48.8867, lon: 2.3431, known: { m: 130, tol: 12, source: 'the Butte Montmartre is about 130 m (Wikipedia: Montmartre)' } },
  { name: 'Paris, Place Pigalle (foot of the hill)', lat: 48.8822, lon: 2.3371 },
  { name: 'San Francisco, Lombard Street top (hilly)', lat: 37.8021, lon: -122.4187 },
  { name: 'San Francisco, Embarcadero (flat, sea level)', lat: 37.7955, lon: -122.3937 },
  { name: 'Barcelona, Eixample (flat)', lat: 41.3917, lon: 2.1649 },
  { name: 'Sydney, Circular Quay (flat, sea level)', lat: -33.861, lon: 151.2111 },
  { name: 'Denver, State Capitol (flat, Mile High)', lat: 39.7393, lon: -104.9848, known: { m: 1609, tol: 15, source: 'the 13th step of the State Capitol is 5,280 ft = 1,609 m' } },
];
const decode = async (png: ArrayBuffer) => { const { data, info } = await sharp(Buffer.from(png)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, channels: 3 }; };

const ref = (await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${SPOTS.map((s) => s.lat).join(',')}&longitude=${SPOTS.map((s) => s.lon).join(',')}`)).json() as { elevation: number[] }).elevation;
const rows = [];
for (const [i, s] of SPOTS.entries()) {
  const g = await fetchGround(s.lat, s.lon, 120, decode, { step: 20 });
  const tiles = groundAt(g, 0, 0), min = Math.min(...g.h), max = Math.max(...g.h);
  rows.push({ place: s.name, lat: s.lat, lon: s.lon, tiles_m: Math.round(tiles * 10) / 10, openMeteo_m: ref[i], diffToOpenMeteo_m: Math.round((tiles - ref[i]) * 10) / 10, known_m: s.known?.m ?? null, diffToKnown_m: s.known ? Math.round((tiles - s.known.m) * 10) / 10 : null, knownSource: s.known?.source ?? null, within_120m: { min_m: min, max_m: max, relief_m: Math.round((max - min) * 10) / 10 } });
}
writeFileSync('data/eval/cc-51-terrain/elevations.json', JSON.stringify(rows, null, 2) + '\n');
writeFileSync('data/eval/cc-51-terrain/run.json', JSON.stringify({ experiment: 'cc-51-terrain', date: new Date().toISOString().slice(0, 10), source: 'AWS Terrain Tiles (Terrarium, zoom 15) vs Open-Meteo elevation API (Copernicus GLO-90, a surface model that includes buildings and trees) and two facts', radius_m: 120, step_m: 20, passes: rows.map((r) => ({ place: r.place, ok: r.known_m === null ? Math.abs(r.diffToOpenMeteo_m) <= 15 : Math.abs(r.diffToKnown_m!) <= (SPOTS.find((s) => s.name === r.place)!.known!.tol) })) }, null, 2) + '\n');
console.table(rows.map((r) => ({ place: r.place, tiles: r.tiles_m, openMeteo: r.openMeteo_m, known: r.known_m, relief120: r.within_120m.relief_m })));
