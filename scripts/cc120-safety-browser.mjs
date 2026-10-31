// CC-120: drive the real Make your own page on the preview with one mild stand-in picture, and photograph the message the player reads.
// Usage: node scripts/cc120-safety-browser.mjs <preview url> <picture> <out png> [hide]   ("hide" greys out the uploaded photo before the screenshot)
import { chromium } from 'playwright';
const [base, pic, out, hide] = process.argv.slice(2);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(`${base}/?mode=communities`);
await p.click('#make-own');
await p.setInputFiles('#cfile', pic);
await p.waitForSelector('.stage img', { timeout: 20000 });
const box = await p.locator('.stage img').boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForFunction(() => document.querySelector('#cinfo')?.textContent === 'Area marked.');
await p.click('#cnext');
await p.click('#cseg');
await p.waitForSelector('#cmsg, .err', { timeout: 120000 }).catch(() => {});
await p.waitForFunction(() => /cannot be used|person to look|could not run|Found/.test(document.body.innerText), null, { timeout: 120000 });
if (hide) await p.addStyleTag({ content: '.stage img{visibility:hidden} .stage{background:#d8dcd9}' });
console.log(await p.evaluate(() => [...document.querySelectorAll('.err,.muted')].map((e) => e.textContent).filter((t) => /photo|safety/.test(t)).join(' | ')));
await p.screenshot({ path: out });
await b.close();
