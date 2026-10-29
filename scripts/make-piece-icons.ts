// CC-96: the pictures in the add browser.
//   npm run piece-icons                 every piece
//   npm run piece-icons -- lache band   only the pieces whose id contains one of the words
// Each piece is drawn by the editor's own 3D view (src/slice/piece-icons-page.ts): 160x120 for the grid, 640x360 for the featured view, WebP in public/assets/pieces/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { STATIC_PIECES, realInfo } from '../src/slice/piece-info';

const port = process.env.PORT ?? '5173';
const only = process.argv.slice(2);
const index = JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')) as { objects: { name: string; label: string; author: string; licence: string }[] };
const ids = [...STATIC_PIECES.map((p) => p.id), ...index.objects.map((o) => realInfo(o).id)];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const out: Record<string, string> = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('public/assets/pieces', { recursive: true });
  for (const id of ids) {
    if (only.length && !only.some((w) => id.includes(w))) continue;
    const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
    await page.addInitScript('window.__name = (f) => f'); // tsx wraps named functions with __name, which the page does not have
    try {
      await page.goto(`http://localhost:${port}/piece-icons.html?id=${encodeURIComponent(id)}`);
      await page.waitForFunction(() => document.documentElement.dataset.ready !== undefined, null, { timeout: 90000 });
      if (await page.evaluate(() => document.documentElement.dataset.ready === 'empty')) { out[id] = 'FAILED: nothing to draw'; await page.close(); continue; }
      const png = (await page.locator('#wrap').screenshot({ type: 'png' })).toString('base64');
      const flat = ['band', 'photo', 'import', 'bar', 'lache', 'rope'].includes(id);
      const [large, small] = await page.evaluate(async ([data, isFlat]) => {
        const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
        // a 3D piece is centred and scaled to fill the frame: the box around every pixel that is not the plain ground
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (!isFlat) {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
          const px = g.getImageData(0, 0, c.width, c.height).data;
          let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
          for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            if (Math.abs(px[i] - 230) + Math.abs(px[i + 1] - 237) + Math.abs(px[i + 2] - 233) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          }
          if (x1 > x0 && y1 > y0) {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = (x1 - x0) * 1.2, h = (y1 - y0) * 1.2;
            sw = Math.max(w, (h * 16) / 9); sh = (sw * 9) / 16; sx = cx - sw / 2; sy = cy - sh / 2;
          }
        }
        const make = (w: number, h: number, q: number) => { const o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d')!; g.fillStyle = '#e6ede9'; g.fillRect(0, 0, w, h); g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return o.toDataURL('image/webp', q).split(',')[1]; };
        return [make(640, 360, 0.82), make(160, 90, 0.82)];
      }, [png, flat] as const);
      writeFileSync(`public/assets/pieces/${id}-large.webp`, Buffer.from(large, 'base64'));
      writeFileSync(`public/assets/pieces/${id}.webp`, Buffer.from(small, 'base64'));
      out[id] = `${Math.round(Buffer.from(small, 'base64').length / 1024)} KB small, ${Math.round(Buffer.from(large, 'base64').length / 1024)} KB large`;
    } catch (e) { out[id] = `FAILED: ${(e as Error).message.slice(0, 100)}`; }
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
} finally { server.kill(); }
