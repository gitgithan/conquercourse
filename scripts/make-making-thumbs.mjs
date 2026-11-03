// CC-132: the two Making Of card pictures (640x360 WebP, public/assets/thumbs/making-*.webp), our own screenshots of our own static pages at 1280x720.
//   node scripts/make-making-thumbs.mjs
// The Parts card keeps its picture parts.webp (made by make-thumbs.ts).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const port = process.env.PORT ?? '5174';
const PAGES = { 'making-site-map': '/making-of/site-map.html', 'making-course-map': '/making-of/course-map.html' };
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  for (const [slug, path] of Object.entries(PAGES)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://localhost:${port}${path}`);
    await page.waitForTimeout(1500);
    const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
    const webp = await page.evaluate(async (data) => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const c = document.createElement('canvas'); c.width = 640; c.height = 360;
      c.getContext('2d').drawImage(img, 0, 0, 640, 360);
      return c.toDataURL('image/webp', 0.7).split(',')[1];
    }, b64);
    const buf = Buffer.from(webp, 'base64');
    writeFileSync(`public/assets/thumbs/${slug}.webp`, buf);
    console.log(slug, Math.round(buf.length / 1024), 'KB');
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
