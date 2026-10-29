// Concept stills for the film's beats 1 to 3 (CC-209): the stored OpenStreetMap buildings of a Ready place drawn as a street map,
// as the slice sweeps through it, and as blocks rising from it. A faithful stand-in, not the app: no tiles are downloaded.
// Usage: node scripts/osm-concept.mjs <slug> <out-dir>
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const [slug = 'montmartre-paris', out = 'films'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
const W = 1280, H = 720, R = place.radius, S = (H * 0.46) / R * 1.0; // px per metre
const m = (lat, lon) => [(lon - place.lon) * 111320 * Math.cos((place.lat * Math.PI) / 180), -(lat - place.lat) * 110540]; // east, south
const bs = place.answer.elements.filter((e) => e.geometry && e.tags?.building).map((e) => {
  const ring = e.geometry.map((g) => m(g.lat, g.lon));
  const h = Number(e.tags.height) || (Number(e.tags['building:levels']) || 3) * 3.2;
  return { ring, h: Math.min(h, 40) };
});
const [lx0, lz0, lx1, lz1] = place.lane.line;
const P = ([x, z], lift = 0, skew = 0) => [W / 2 + x * S + skew * 0.35 * lift, H / 2 + z * S - lift * 1.6];
const poly = (pts, fill, stroke) => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
const flat = (b, fill = '#d8cfc6', stroke = '#bfb2a5') => poly(b.ring.map((p) => P(p)), fill, stroke);
const block = (b, up, tint) => {
  const h = b.h * up; const base = b.ring.map((p) => P(p)), top = b.ring.map((p) => P(p, h, 1));
  let s = '';
  for (let i = 0; i < b.ring.length - 1; i++) s += poly([base[i], base[i + 1], top[i + 1], top[i]], tint[0], tint[1]);
  return s + poly(top, tint[2], tint[1]);
};
const order = [...bs].sort((a, b) => a.ring[0][1] - b.ring[0][1]);
const ground = `<rect width="${W}" height="${H}" fill="#f2efe9"/>`;
const credit = `<text x="${W - 14}" y="${H - 14}" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="13" fill="#6b645c">Map data: OpenStreetMap contributors</text>`;
const title = (t) => `<text x="24" y="40" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#4a443d">${t}</text>`;
const lane = (w = 5) => `<line x1="${P([lx0, lz0])[0]}" y1="${P([lx0, lz0])[1]}" x2="${P([lx1, lz1])[0]}" y2="${P([lx1, lz1])[1]}" stroke="#ff9a3c" stroke-width="${w}" stroke-linecap="round"/>`;
// the slicing plane: a bright line across the map, perpendicular to the lane's own direction, 55% of the way along
const dx = lx1 - lx0, dz = lz1 - lz0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
const sweep = (u) => { const c = [lx0 + ux * L * u, lz0 + uz * L * u], a = P([c[0] - uz * R, c[1] + ux * R]), b = P([c[0] + uz * R, c[1] - ux * R]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2f8cff" stroke-width="3" opacity="0.9"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2f8cff" stroke-width="22" opacity="0.18"/>`; };
const behind = (b, u) => { const cx = b.ring.reduce((t, p) => t + p[0], 0) / b.ring.length, cz = b.ring.reduce((t, p) => t + p[1], 0) / b.ring.length; return ((cx - lx0) * ux + (cz - lz0) * uz) / L < u; };
const tint = ['#cfc3b6', '#9d8f80', '#ece4da'];
const frames = {
  'beat1-street-map': `${ground}${bs.map((b) => flat(b)).join('')}${title('Paris: the street map')}${credit}`,
  'beat2-slice': `${ground}${bs.map((b) => flat(b)).join('')}${order.filter((b) => behind(b, 0.55)).map((b) => block(b, 0.6, tint)).join('')}${sweep(0.55)}${title('The cut sweeps through')}${credit}`,
  'beat3-blocks-rise': `${ground}${order.map((b) => block(b, 1, tint)).join('')}${lane(6)}${title('The buildings rise: this is the course')}${credit}`,
};
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: W, height: H } });
for (const [name, svg] of Object.entries(frames)) {
  await pg.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg></body>`);
  await pg.screenshot({ path: `${out}/${name}.png` });
}
await br.close(); console.log('wrote', Object.keys(frames).join(', '));
