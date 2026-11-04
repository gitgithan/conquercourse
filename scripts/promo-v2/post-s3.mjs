// Scene 3 post (CC-133): cut the capture by its marks, speed each part up to its time cap, burn the overlays (bottom text, blue Meta chips top left), join.
// usage: node post-s3.mjs <capture-dir> <out.mp4>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [dir, outMp4] = process.argv.slice(2);
const M = JSON.parse(readFileSync(`${dir}/marks.json`, 'utf8')), m = M.marks, fps = M.fps;
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const parts = [
  { a: 'A0', b: 'B0', cap: 8, text: 'Choose your course' },
  { a: 'B0', b: 'B1', cap: 4, text: 'Add your objects' },
  { a: 'B1', b: 'B3', cap: 4, text: 'Add your objects' },
  { a: 'B3', b: 'C4', cap: 4, text: 'Design partner to suggest fixes', chip: 'Muse Spark Open design partner (Meta)' },
  { a: 'C4', b: 'D1', cap: 4, text: 'Accept changes' },
  { a: 'D1', b: 'F0', cap: 7, text: 'Add moves by tweaking obstacles' },
  { a: 'F0', b: 'end', cap: 99, text: '' },
];
const esc = (t) => t.replace(/[:\\']/g, (c) => '\\' + c);
const tmp = `${dir}/post`; mkdirSync(tmp, { recursive: true });
const report = [];
parts.forEach((q, i) => {
  const from = m[q.a], to = m[q.b], dur = to - from; if (!(dur > 0.05)) { report.push({ ...q, skipped: true }); return; }
  const k = Math.max(1, +(dur / q.cap).toFixed(3)), n = Math.ceil(k), vf = [];
  if (k > 1.001) vf.push(`tmix=frames=${n}`, `setpts=PTS/${k}`, `fps=${fps}`);
  vf.push('scale=1920:1080:flags=lanczos');
  if (q.text) vf.push(`drawtext=fontfile=${FONT}:text='${esc(q.text)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=h-120:box=1:boxcolor=black@0.62:boxborderw=22`);
  if (q.chip) vf.push(`drawtext=fontfile=${FONT}:text='${esc(q.chip)}':fontcolor=white:fontsize=34:x=36:y=36:box=1:boxcolor=0x1877F2@0.95:boxborderw=14`);
  vf.push('format=yuv420p');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-start_number', String(Math.round(from * fps)), '-t', String(dur), '-i', `${dir}/frames/f%05d.jpg`, '-vf', vf.join(','), '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-r', String(fps), `${tmp}/p${i}.mp4`], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg part ' + i);
  report.push({ ...q, gameSecs: +dur.toFixed(2), speedUp: k, finalSecs: +(dur / k).toFixed(2), file: `p${i}.mp4` });
});
const list = report.filter((r) => r.file).map((r) => `file '${tmp}/${r.file}'`).join('\n');
writeFileSync(`${tmp}/list.txt`, list);
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`, '-c', 'copy', outMp4], { stdio: 'inherit' });
if (r.status) throw new Error('concat');
writeFileSync(`${dir}/post.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((x) => [x.text, x.gameSecs, x.finalSecs])), 'total', report.reduce((s, x) => s + (x.finalSecs || 0), 0).toFixed(1));
