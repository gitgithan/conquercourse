// CC-89: one small picture per course card in the Courses gallery.
//   npm run thumbs                 every course in the list
//   npm run thumbs -- lache band   only the courses whose file name contains one of the words
// Each picture is the course at its first obstacle (the page without any buttons), 480x270 WebP, in public/assets/thumbs/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DEMOS, hasThumb, thumbSlug } from '../src/ui/world-picker';

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
    let url = `http://localhost:${port}/?welcome=0&photos=0`;
    if (value) {
      url += `&course=${value}`;
      const file = `public${value}`;
      const course = JSON.parse(readFileSync(file, 'utf8')) as { startX?: number; zones?: { x0: number }[] };
      const first = course.zones?.[0]?.x0;
      if (first !== undefined && first - 3 > (course.startX ?? 0)) url += `&startx=${(first - 3).toFixed(1)}`; // stand just before the first obstacle
    }
    try {
      await page.goto(url);
      await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
      await page.addStyleTag({ content: 'body > :not(canvas){display:none!important}' }); // the picture is the world, not the buttons
      await page.waitForTimeout(2500);
      const png = await page.screenshot({ type: 'png' });
      const b64 = png.toString('base64');
      const webp = await page.evaluate(async (data) => {
        const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
        const c = document.createElement('canvas'); c.width = 480; c.height = 270;
        c.getContext('2d')!.drawImage(img, 0, 0, 480, 270);
        return c.toDataURL('image/webp', 0.72).split(',')[1];
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
