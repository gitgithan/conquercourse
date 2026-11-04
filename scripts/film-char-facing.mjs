// One take of a made character in the real Course, holding one arrow key, on the stepped clock (true speed on a software GPU).
// usage: node scripts/film-char-facing.mjs --name banana-asmade --char 7c95df17d131f152 --fit 0 --key ArrowRight [--frames 90] [--pre ArrowRight --pre-ms 5000] [--settle 2500] [--out films-char]
import { Shot, arg } from './film-lib.mjs';
const name = arg('name', 'take'), out = arg('out', 'films-char'), fps = Number(arg('fps', 30)), frames = Number(arg('frames', 90));
const q = `course=/assets/parts/run.course.json&char=${arg('char')}&fit=${arg('fit', 1)}&welcome=0&nav=0&music=0&photos=0&charguard=0&nosave=1${arg('fit', 1) === '0' ? '&nofacing=1' : ''}`;
const shot = new Shot({ name, outDir: out, fps, width: 1280, height: 720 });
const page = await shot.open(`${arg('base', 'http://localhost:5173')}/?${q}`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 }) });
shot.sub = 2;
await shot.advance(4000); // the character loads and is fitted
await page.keyboard.press('h'); // hide the Controls panel
await page.mouse.move(640, 360); await page.mouse.wheel(0, -Number(arg('zoom', 800))); // the wheel zooms the Course camera in to its closest normal view (0.45)
await shot.advance(1500); // the camera eases in
if (arg('pre', '')) { await page.keyboard.down(arg('pre')); await shot.advance(Number(arg('pre-ms', 5000))); await page.keyboard.up(arg('pre')); } // optional lead-in run (not kept): a left run starts after a run right, because the Course starts at its left edge
for (const k of arg('key', 'ArrowRight').split(',')) { await page.keyboard.down(k); await shot.advance(Number(arg('settle', 2500))); await shot.frames(frames); await page.keyboard.up(k); } // settle: the run and the camera reach a steady look first, not kept
await shot.close();
console.log(name, 'done');
process.exit(0);
