// Usage: npx tsx scripts/training-side-picture.ts [outdir]   (CC-175)
// Draws the Training course from the side with the stored ideal run, and a close-up of the warped wall catch. No browser needed: the shapes come from the course file and the path from the simulator.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';

const out = process.argv[2] ?? 'data/eval/cc-175-all-basic'; mkdirSync(out, { recursive: true });
const c = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const path: { x: number; y: number; wall: boolean }[] = [];
const r = playPlan(c, c.plan!, 120 * 80, (w) => { if (w.runner.tick % 6 === 0) path.push({ x: w.runner.x, y: w.runner.y, wall: w.mode === 'wall' }); });
const ev = r.events.filter((e) => e.type === 'wall-grab');
function draw(x0: number, x1: number, y0: number, y1: number, px: number, file: string, labels: boolean) {
  const W = (x1 - x0) * px, H = (y1 - y0) * px, X = (x: number) => (x - x0) * px, Y = (y: number) => (y1 - y) * px;
  const s: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#12161c"/>`];
  for (const p of c.terrain.platforms) s.push(`<rect x="${X(p.x0)}" y="${Y(p.top)}" width="${(p.x1 - p.x0) * px}" height="${(p.top - y0) * px}" fill="${p.bouncy ? '#e0a030' : '#3b4656'}"/>`);
  if (c.wall) { const h = c.wall.height ?? 4, g = c.terrain.platforms.find((p) => p.x0 <= c.wall!.x0 && p.x1 > c.wall!.x0)!.top; const pts = [`${X(c.wall.x0)},${Y(g)}`]; for (let i = 0; i <= 20; i++) { const th = (i / 20) * Math.PI / 2; pts.push(`${X(c.wall.x0 + h * Math.sin(th))},${Y(g + h * (1 - Math.cos(th)))}`); } pts.push(`${X(c.wall.x0 + h)},${Y(g)}`); s.push(`<polygon points="${pts.join(' ')}" fill="#8a5a3a"/>`); }
  for (const p of c.planks ?? []) s.push(`<rect x="${X(p.x0)}" y="${Y(p.y)}" width="${(p.x1 - p.x0) * px}" height="${Math.max(3, px * 0.15)}" fill="#c9a26b"/>`);
  for (const h of c.holds ?? []) s.push(`<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${px * 0.25}" fill="#e8d44d"/>`);
  if (c.rope) { s.push(`<line x1="${X(c.rope.anchorX)}" y1="${Y(c.rope.anchorY)}" x2="${X(c.rope.anchorX)}" y2="${Y(c.rope.anchorY - (c.rope.length ?? 9))}" stroke="#ddd" stroke-width="2"/>`); }
  s.push(`<polyline fill="none" stroke="#4fd1c5" stroke-width="2" points="${path.filter((p) => p.x >= x0 - 2 && p.x <= x1 + 2).map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}"/>`);
  if (labels) for (const z of c.zones ?? []) s.push(`<text x="${X(z.x0)}" y="${Y(-5.2)}" fill="#fff" font-size="13" font-family="sans-serif">${z.name}</text>`);
  for (const e of ev) { const q = path.find((p) => p.wall); void q; }
  s.push('</svg>'); return sharp(Buffer.from(s.join(''))).png().toFile(`${out}/${file}`);
}
await draw(-10, 300, -6, 18, 6, 'whole-course-side.png', true);
const wx = c.wall!.x0;
await draw(wx - 8, wx + 10, -1, 8, 50, 'warped-wall-catch.png', false);
console.log('ideal ticks', r.world.runner.tick, 'wall-grab events', ev.length);
