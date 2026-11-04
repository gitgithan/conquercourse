// CC-133 realism: 1280 px stills of the place scenery with building styles and the library photo facade (needs the dev server on :5199)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [['bstyle0-facade0', 'bstyle=0&facade=0'], ['bstyle1-facade1', 'bstyle=1&facade=1'], ['facade-closeup', 'bstyle=1&facade=1&az=61&el=6&dist=420']];
for (const [name, qs] of shots) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:5199/place-skin.html?place=bryant-park-new-york&skin=full&${qs}&az=119&el=10&dist=300`);
  await p.waitForFunction(() => window.__skin?.ready, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `docs/evidence/cc-133-realism/${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate(() => window.__skin.stats)));
  await p.close();
}
await b.close();
