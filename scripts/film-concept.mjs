// The film's opening beats as animated frames (CC-209): Earth to street map, the slicing sweep, blocks rising, the photo-lifted box, the lane settling to the course.
// Drawn from the stored OpenStreetMap buildings of a Ready place and the hero course; no tiles are downloaded. Concept art: it stands in for the app's own screens.
// Usage: node scripts/film-concept.mjs <slug> <course.json> <out-dir> [beat]   (beat = 1, 2 or 3; default all). Writes <out-dir>/beat<N>-frames/%04d.png and beat<N>-concept.mp4 at 30 fps.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [slug = 'montmartre-paris', coursePath = 'public/assets/demo/hero-montmartre-paris.course.json', out = 'films', only = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')), course = JSON.parse(readFileSync(coursePath, 'utf8'));
const W = 1280, H = 720, R = place.radius, S0 = (H * 0.46) / R, FPS = 30;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ease = (u) => { u = clamp(u); return u * u * (3 - 2 * u); }, mix = (a, b, u) => a + (b - a) * u;
const m = (lat, lon) => [(lon - place.lon) * 111320 * Math.cos((place.lat * Math.PI) / 180), -(lat - place.lat) * 110540];
const bs = place.answer.elements.filter((e) => e.geometry && e.tags?.building).map((e) => ({ ring: e.geometry.map((g) => m(g.lat, g.lon)), h: Math.min(Number(e.tags.height) || (Number(e.tags['building:levels']) || 3) * 3.2, 40) }));
const order = [...bs].sort((a, b) => a.ring[0][1] - b.ring[0][1]);
const [lx0, lz0, lx1, lz1] = place.lane.line, dx = lx1 - lx0, dz = lz1 - lz0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
const along = (b) => { const cx = b.ring.reduce((t, p) => t + p[0], 0) / b.ring.length, cz = b.ring.reduce((t, p) => t + p[1], 0) / b.ring.length; return ((cx - lx0) * ux + (cz - lz0) * uz) / L; };
const FONT = 'font-family="Helvetica,Arial,sans-serif"';
const img = (f, type) => `data:${type};base64,${readFileSync(f).toString('base64')}`;
const photo = img('public/assets/park/park03.jpg', 'image/jpeg'), icon = img('data/eval/cc-spectacle/film/assets/box-skate-03-cutout.png', 'image/png');
const tint = ['#cfc3b6', '#9d8f80', '#ece4da'];
const poly = (pts, fill, stroke) => `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
const KEY = '';
const credit = `<text x="${W - 14}" y="${H - 14}" text-anchor="end" ${FONT} font-size="13" fill="#6b645c">Map data: OpenStreetMap contributors</text>`;

// view: k = zoom about the place centre, lean = how far the oblique tilt is applied (0 = flat map)
const proj = (k) => { const S = S0 * k; return (p, lift = 0, lean = 1) => [W / 2 + p[0] * S + lean * lift * 0.35 * S0, H / 2 + p[1] * S - lean * lift * 1.6 * S0]; };
const flat = (P, b, fill = '#d8cfc6', stroke = '#bfb2a5') => poly(b.ring.map((p) => P(p)), fill, stroke);
const block = (P, b, up, t = tint) => {
  const h = b.h * up, base = b.ring.map((p) => P(p)), top = b.ring.map((p) => P(p, h, 1));
  let s = ''; for (let i = 0; i < b.ring.length - 1; i++) s += poly([base[i], base[i + 1], top[i + 1], top[i]], t[0], t[1]);
  return s + poly(top, t[2], t[1]);
};
const laneSvg = (P, u, w = 6) => { const a = P([lx0, lz0]), b = P([lx0 + dx * u, lz0 + dz * u]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#ff9a3c" stroke-width="${w}" stroke-linecap="round"/>`; };
const sweep = (P, u) => { const c = [lx0 + dx * u, lz0 + dz * u], a = P([c[0] - uz * R, c[1] + ux * R]), b = P([c[0] + uz * R, c[1] - ux * R]); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2f8cff" stroke-width="22" opacity="0.18"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2f8cff" stroke-width="3" opacity="0.9"/>`; };
const paper = `<rect width="${W}" height="${H}" fill="#f2efe9"/>`;

// Earth: a drawn globe (graticule only, no coastlines), turning until the place is in front, then growing until the map takes over
function globe(t, T) {
  const u = t / T, r = mix(150, 900, ease(u) ** 2.2), cx = W / 2, cy = H / 2, turn = mix(1.2, 0, ease(u * 1.2));
  let s = `<rect width="${W}" height="${H}" fill="#0b1020"/>`;
  s += `<defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#4f86c6"/><stop offset="1" stop-color="#1c3a66"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g)"/>`;
  for (let i = -3; i <= 3; i++) { const a = i * 0.45 + turn, x = Math.sin(a), rx = Math.abs(Math.cos(a)) * r; if (Math.cos(a) > 0) s += `<ellipse cx="${cx + x * r * 0.0}" cy="${cy}" rx="${Math.abs(Math.sin(a)) * r}" ry="${r}" fill="none" stroke="#9fc2e6" stroke-opacity="0.35" stroke-width="1.4"/>`; }
  for (let j = -2; j <= 2; j++) { const y = (j / 3) * r * 0.9, rx = Math.sqrt(Math.max(0, r * r - y * y)); s += `<ellipse cx="${cx}" cy="${cy + y}" rx="${rx}" ry="${rx * 0.12}" fill="none" stroke="#9fc2e6" stroke-opacity="0.35" stroke-width="1.4"/>`; }
  s += `<circle cx="${cx}" cy="${cy - r * 0.07}" r="${mix(6, 2, u) + 3 * (0.5 + 0.5 * Math.sin(t * 6))}" fill="#ff9a3c"/>`;
  return s;
}
// the street map zooms from far out to the street scale
const mapAt = (k) => { const P = proj(k); return `${paper}${bs.map((b) => flat(P, b)).join('')}`; };

const frames = {
  1: { T: 7.2, draw(t) {
    const g = ease((t - 2.0) / 1.2), k = mix(0.08, 1, ease((t - 2.2) / 5.0));
    return g < 1 ? `${globe(Math.min(t, 3.4), 3.4)}<g opacity="${g}">${mapAt(k)}${credit}</g>` : `${mapAt(k)}${credit}`;
  } },
  2: { T: 7.2, draw(t) {
    const P = proj(1), pos = mix(-0.1, 1.15, ease((t - 0.3) / 5.8));
    const lifted = (b) => 0.6 * ease((pos - along(b)) / 0.14);
    return `${paper}${bs.map((b) => (lifted(b) <= 0.001 ? flat(P, b) : '')).join('')}${order.map((b) => (lifted(b) > 0.001 ? block(P, b, lifted(b)) : '')).join('')}${sweep(P, pos)}${credit}`;
  } },
  3: { T: 14.4, draw(t) {
    const P = proj(1), rise = ease(t / 3.4), lean = 1, laneU = ease((t - 1.5) / 2.2);
    const city = `${paper}${order.map((b) => block(P, b, mix(0.6, 1, rise), tint)).join('')}${laneSvg(P, laneU)}`;
    const city2 = (op) => `<g opacity="${op}">${city}${credit}</g>`;
    // the photo: a card slides in, the box is circled, then the same box stands there as a 3D object and drops onto the lane
    const pin = ease((t - 4.0) / 0.8) * (1 - ease((t - 6.6) / 0.6)), cardX = mix(W + 20, W - 540, ease((t - 4.0) / 0.9)) + mix(0, 200, ease((t - 7.4) / 0.8));
    const pulse = 0.5 + 0.5 * Math.sin((t - 4.6) * 7), [bx0, by0, bx1, by1] = [66, 234, 662, 407], sc = 520 / 1024;
    const card = pin > 0.01 ? `<g opacity="${pin}"><rect x="${cardX - 8}" y="92" width="${1024 * sc + 16}" height="${468 * sc + 54}" rx="10" fill="#fff"/><image href="${photo}" x="${cardX}" y="100" width="${1024 * sc}" height="${468 * sc}"/><rect x="${cardX + bx0 * sc}" y="${100 + by0 * sc}" width="${(bx1 - bx0) * sc}" height="${(by1 - by0) * sc}" fill="none" stroke="#ff9a3c" stroke-width="${3 + 2 * pulse}"/><text x="${cardX}" y="${100 + 468 * sc + 30}" ${FONT} font-size="13" fill="#4a443d">Photo: Alexis Jazz, Voltaplatz skatepark, CC BY 4.0</text></g>` : '';
    const iu = ease((t - 6.2) / 0.8), drop = ease((t - 7.6) / 1.2), lp = P([lx0 + dx * 0.42, lz0 + dz * 0.42]);
    const ix = mix(W - 300, lp[0] - 110, drop), iy = mix(220, lp[1] - 120, drop) - 40 * Math.sin(Math.PI * drop), iw = mix(300, 220, drop);
    const obj = iu > 0.01 ? `<g opacity="${iu}"><image href="${icon}" x="${ix}" y="${iy}" width="${iw}" height="${iw * 0.5625}"/></g>` : '';
    const side = ease((t - 9.2) / 1.6), settle = ease((t - 10.4) / 3.6);
    return `${side > 0.99 ? '' : city2(1 - side)}${card}${obj}${side > 0.001 ? `<g opacity="${side}">${sideView(settle)}</g>` : ''}`;
  } },
};

// the side view of the hero course: sky, water, the platforms as the game draws them, the lifted box and the rope
function sideView(settle) {
  const T = course.terrain, xa = -10, xb = 88, zoom = mix(0.9, 1.0, settle), sx = (W / (xb - xa)) * zoom, gy = H * 0.62, sy = sx;
  const X = (x) => (x - xa) * sx + W * (1 - zoom) / 2, Y = (y) => gy - y * sy;
  let s = `<rect width="${W}" height="${H}" fill="#9fc2e6"/><rect y="${Y(T.waterY)}" width="${W}" height="${H}" fill="#5593c9"/>`;
  for (const p of T.platforms) {
    const top = p.profile ? p.profile : [[p.x0, p.top], [p.x1, p.top]], pts = [[p.x0, p.top - 9], ...top, [p.x1, p.top - 9]];
    s += `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="#6a9a52"/><polyline points="${top.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="none" stroke="#86b56b" stroke-width="5"/>`;
  }
  for (const o of course.scene ?? []) s += `<image href="${icon}" x="${X(o.x) - 60}" y="${Y(o.y) - 56}" width="120" height="68"/>`;
  const r = course.rope; if (r) s += `<line x1="${X(r.anchorX)}" y1="${Y(r.anchorY)}" x2="${X(r.anchorX)}" y2="${Y(r.anchorY - r.length)}" stroke="#4a3b2c" stroke-width="5"/><circle cx="${X(r.anchorX)}" cy="${Y(r.anchorY)}" r="6" fill="#4a3b2c"/>`;
  return s;
}

const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: W, height: H } });
for (const [n, f] of Object.entries(frames)) {
  if (only && only !== n) continue;
  const dir = `${out}/beat${n}-frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const N = Math.round(f.T * FPS);
  await pg.setContent(`<body style="margin:0;background:#000"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"></svg></body>`);
  for (let i = 0; i < N; i++) { await pg.evaluate((svg) => { document.getElementById('s').innerHTML = svg; }, KEY + f.draw(i / FPS)); await pg.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.png` }); }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%04d.png`, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', `${out}/beat${n}-concept.mp4`]);
  rmSync(dir, { recursive: true, force: true }); console.log('wrote', `${out}/beat${n}-concept.mp4`, N, 'frames');
}
await br.close();
