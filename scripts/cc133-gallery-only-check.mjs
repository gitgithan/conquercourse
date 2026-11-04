// Checks the new Slicer screen: no side list, one Browse button, a full-screen gallery with cards and 3D look links.
// Usage: PORT=5173 node scripts/cc133-gallery-only-check.mjs  (picture goes to docs/evidence/cc-133-ready-gallery/gallery-only.png)
import { chromium } from 'playwright';
const port = process.env.PORT ?? '5173';
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://localhost:${port}/?mode=map&backend=webgl2`);
await p.waitForSelector('#ready-gallery-btn', { timeout: 90000 });
const noSideList = (await p.$('#ready')) === null;
await p.click('#ready-gallery-btn');
await p.waitForTimeout(1500);
const cards = (await p.$$('#ready-gallery button.card')).length;
const links = (await p.$$('#ready-gallery a.look3d')).length;
await p.screenshot({ path: 'docs/evidence/cc-133-ready-gallery/gallery-only.png' });
console.log(JSON.stringify({ noSideList, cards, links, pass: noSideList && cards >= 12 && links === cards }));
await b.close();
