import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
for (const name of ['Old Town','Speicherstadt','Alfama','Dolores Park','Main Square']) {
  await p.goto('https://preview.conquercourse.pages.dev/?mode=map&welcome=0&hooks=1&slicehow=1');
  await p.waitForSelector('html[data-mapready=true]', { timeout: 60000 }).catch(()=>{});
  await p.locator(`text=${name}`).first().click().catch(()=>console.log('noclick',name));
  await p.waitForTimeout(3000); await p.click('#slice').catch(()=>{});
  const seen=[]; for (let i=0;i<14;i++){ await p.waitForTimeout(1500); seen.push(await p.evaluate(()=>document.documentElement.dataset.sliceLane)); }
  console.log(name, seen.filter((x,i)=>x!==seen[i-1]).join('>'), await p.evaluate(()=>document.querySelector('#cutv')?.textContent));
}
await b.close();
