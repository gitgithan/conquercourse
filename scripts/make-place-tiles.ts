// CC-207: a clean tile for every Ready place with no photo: a skyline of its real buildings (OpenStreetMap heights, side-on, left to right = west to east).
// Output: public/assets/places/tiles/<slug>.svg (each a few KB). No photo, no person. Usage: npx tsx scripts/make-place-tiles.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { buildingsFrom } from '../src/world/osm';

const index = JSON.parse(readFileSync('public/assets/places/index.json', 'utf8')) as { slug: string }[];
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
for (const { slug } of index) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const all = buildingsFrom(p.answer, p.lat, p.lon).map((b) => ({ x: b.ring.reduce((t, q) => t + q[0], 0) / b.ring.length, h: Math.min(b.h, 60), w: Math.max(...b.ring.map((q) => q[0])) - Math.min(...b.ring.map((q) => q[0])) })).sort((a, b) => a.x - b.x), bs = all.length > 70 ? all.filter((_, i) => i % Math.ceil(all.length / 70) === 0) : all; // at most about 70 bars: the tile stays small
  const W = 240, H = 135, hu = hue(slug), top = Math.max(12, ...bs.map((b) => b.h)), xs = bs.map((b) => b.x), x0 = Math.min(...xs, -p.radius), x1 = Math.max(...xs, p.radius);
  const bars = bs.map((b, i) => {
    const w = Math.max(3, Math.min(22, (b.w / (x1 - x0)) * W * 1.2)), x = ((b.x - x0) / (x1 - x0)) * (W - w), h = 14 + (b.h / top) * 70;
    return `<rect x="${x.toFixed(1)}" y="${(H - 22 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="hsl(${hu} ${30 + (i % 3) * 8}% ${34 + (i % 4) * 7}%)"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="hsl(${hu} 40% 90%)"/>${bars}<rect y="${H - 22}" width="${W}" height="22" fill="hsl(${hu} 25% 25%)"/></svg>\n`;
  writeFileSync(`public/assets/places/tiles/${slug}.svg`, svg);
}
console.log('tiles', index.length);
