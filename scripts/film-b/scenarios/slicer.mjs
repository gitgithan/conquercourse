export default async ({ page, frame, frames, log, url }) => {
  await page.goto(url('?mode=map&hooks=1&places=all'));
  await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 120000 }).catch(() => log('map style slow'));
  await page.waitForSelector('#ready .card', { timeout: 60000 });
  await frames(15);
  await page.waitForSelector('#ready button.card', { state: 'attached', timeout: 90000 });
  await page.evaluate(() => { const b = document.querySelector('#ready button.card'); b.scrollIntoView({ block: 'center' }); b.click(); });
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Feedback').forEach((b) => (b.style.display = 'none')));
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 30000 });
  log('place chosen');
  await frames(40); // camera flies to the place on the stepped clock
  await page.$eval('#radius', (el) => { el.value = '170'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await frames(12);
  await page.click('#slice'); log('slice');
  for (let k = 0; k < 70; k++) { await frame(); if (await page.evaluate(() => document.documentElement.dataset.flightDone === '1')) break; }
  log('flight done');
  await frames(6);
};
