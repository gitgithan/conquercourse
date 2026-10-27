// Builds public/assets/park/: web-sized photos and the detected objects (from the saved SAM 3.1 results, CC-24).
// Run: node scripts/make-park-assets.mjs   (needs ffmpeg and ffprobe)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'data/eval/sam31-park';
const OUT = 'public/assets/park';
const WIDTH = 1024;
// Only photos whose licence lets the game ship them as they are (CC0, CC BY); see docs/ASSETS.md.
const PHOTOS = ['park01', 'park02', 'park03', 'park06', 'park07'];
const results = JSON.parse(readFileSync(`${SRC}/outputs/results.json`, 'utf8'));
const iou = (a, b) => {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = w * h;
  const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  return Math.max(inter / (area(a) + area(b) - inter), inter / Math.min(area(a), area(b)) - 0.2);
};
mkdirSync(OUT, { recursive: true });
for (const photo of PHOTOS) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${SRC}/inputs/${photo}.jpg`, '-vf', `scale=${WIDTH}:-2`, '-q:v', '5', '-map_metadata', '-1', `${OUT}/${photo}.jpg`]);
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', `${OUT}/${photo}.jpg`]).toString().trim().split(',').map(Number);
  const source = JSON.parse(readFileSync(`${SRC}/inputs/sources.json`, 'utf8')).find((s) => s.file === `${photo}.jpg`);
  const k = w / 1280;
  const all = [];
  for (const r of results.filter((r) => r.photo === photo && r.count))
    r.boxes.forEach((b, i) => all.push({ phrase: r.phrase, score: Math.round(r.scores[i] * 100) / 100, box: b.map((v) => Math.round(v * k)) }));
  all.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const o of all) {
    const area = (o.box[2] - o.box[0]) * (o.box[3] - o.box[1]);
    if (area < 0.015 * w * h) continue; // tiny pieces
    if (area > 0.5 * w * h) continue; // the bank or the whole scene, not an obstacle
    if (kept.some((q) => iou(q.box, o.box) > 0.5)) continue;
    kept.push(o);
  }
  kept.sort((a, b) => a.box[0] - b.box[0]);
  const objects = kept.map((o, i) => ({ id: i + 1, ...o }));
  writeFileSync(`${OUT}/${photo}.objects.json`, JSON.stringify({ photo, file: `${photo}.jpg`, width: w, height: h, credit: `${source.title.replace(/\.jpg$/, '')}, ${source.author}, ${source.licence}`, objects }, null, 2) + '\n');
  console.log(photo, w, h, objects.map((o) => o.phrase).join(', '));
}
