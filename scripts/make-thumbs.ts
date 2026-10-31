// CC-89: one small picture per course card in the Courses gallery.
//   npm run thumbs                 every course in the list
//   npm run thumbs -- lache band   only the courses whose file name contains one of the words
// Each picture is the course with the runner mid-move at its first obstacle (the ideal run, zoomed out, no buttons), 640x360 WebP, in public/assets/thumbs/.
// A card that opens a tool (World Editor, coaster builder, World Slicer, generator, Lab) gets a picture of that tool's page.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEMOS, hasThumb, thumbSlug, WORD_VALUES } from '../src/ui/world-picker';

const port = process.env.PORT ?? '5173';
const only = process.argv.slice(2);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const out: Record<string, string> = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('public/assets/thumbs', { recursive: true });
  for (const [value, label] of DEMOS) {
    if (!hasThumb(value)) continue;
    const slug = thumbSlug(value);
    if (only.length && !only.some((w) => slug.includes(w))) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let url = `http://localhost:${port}/?welcome=0&photos=0&bot=ideal`;
    const tool = WORD_VALUES.includes(value);
    if (tool) url = `http://localhost:${port}/` + ({ editor: '?mode=editor&welcome=0', 'coaster-builder': '?mode=coaster&welcome=0', map: '?mode=map&welcome=0', 'lab-search': '?mode=lab-search&labs=1&welcome=0', generate: '?generate=7&welcome=0&photos=0&bot=ideal' } as Record<string, string>)[value];
    else if (value) {
      url += `&course=${value}`;
      const file = `public${value}`;
      const course = JSON.parse(readFileSync(file, 'utf8')) as { startX?: number; zones?: { x0: number }[] };
      const first = course.zones?.[0]?.x0;
      if (first !== undefined && first - 6 > (course.startX ?? 0)) url += `&startx=${(first - 6).toFixed(1)}`; // start a few steps before the first obstacle, so the runner is mid-move in the picture
    }
    try {
      await page.goto(url);
      if (url.includes('bot=ideal')) {
        await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
        await page.addStyleTag({ content: 'body > :not(canvas){display:none!important}' }); // the picture is the world, not the buttons
        await page.mouse.move(640, 360); await page.mouse.wheel(0, 450); // a wider view: the course, not only the runner
        await page.waitForFunction(() => Number(document.documentElement.dataset.tick) >= 170, null, { timeout: 120000 }); // about 1.4 s into the run
      } else await page.waitForTimeout(6000);
      const png = await page.screenshot({ type: 'png' });
      const b64 = png.toString('base64');
      const webp = await page.evaluate(async (data) => {
        const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
        const c = document.createElement('canvas'); c.width = 640; c.height = 360;
        c.getContext('2d')!.drawImage(img, 0, 0, 640, 360);
        return c.toDataURL('image/webp', 0.8).split(',')[1];
      }, b64);
      writeFileSync(`public/assets/thumbs/${slug}.webp`, Buffer.from(webp, 'base64'));
      out[slug] = `${Math.round(Buffer.from(webp, 'base64').length / 1024)} KB  (${label})`;
    } catch (e) {
      out[slug] = `FAILED: ${(e as Error).message.slice(0, 100)}`;
    }
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
} finally { server.kill(); }
