// Writes manifest.json for one promo-v2b clip folder (CC-133). usage: node manifest.mjs <clipDir> <script> <paramsFile> <clipKey> [commit]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [dir, script, paramsFile, key, commit = 'unknown'] = process.argv.slice(2);
const params = JSON.parse(readFileSync(paramsFile, 'utf8'));
const rt = existsSync(`${dir}/retime.json`) ? JSON.parse(readFileSync(`${dir}/retime.json`, 'utf8')) : null;
const clip = params[key] ?? params;
const manifest = {
  commit, date: '2026-11-05', viewport: '1280x720 at device scale 1.5 = 1920x1080', fps: 30,
  script, params: paramsFile, clip: key, retime: rt,
  overlay: { position: 'bottom of the frame (build: y=h-96)', texts: clip.overlays ?? (clip.overlay ? [{ text: clip.overlay, from: 0, to: rt?.finalSeconds }] : []) },
  chips: { position: 'top left (build: x=28, y=24)', note: 'blue Meta model chips; never overlap the overlay text' },
  clickMarker: 'yellow ring over the cursor, drawn into the frames (scripts/promo-v2/lib.mjs CLICK_MARKER)',
  files: ['frames/', 'marks.json', 'clip.mp4', 'thumb.jpg', 'retime.json'],
};
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest', dir);
