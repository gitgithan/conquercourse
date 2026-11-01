export default async ({ page, frames, frame, log, url }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto(url('?mode=editor&welcome=0')); await page.waitForSelector('#view3d', { timeout: 120000 });
  await frames(6);
  for (const h of await page.getByRole('button', { name: 'Hide', exact: true }).all()) await h.click({ timeout: 3000 }).catch(() => {});
  await page.selectOption('#presetpick', 'failing');
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces ?? 0) >= 4, null, { timeout: 90000 }).catch(() => log('pieces slow'));
  for (const h of await page.getByRole('button', { name: 'Hide', exact: true }).all()) await h.click({ timeout: 3000 }).catch(() => {});
  await page.addStyleTag({ content: 'button.fb,#cc-feedback-btn,.feedback,[class*=feedback]{display:none !important}' });
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Feedback').forEach((b) => (b.style.display = 'none')));
  await page.click('#fitview'); await frames(40); log('fit');
  await page.evaluate(() => { delete document.documentElement.dataset.fixed; document.querySelector('#fixit')?.click(); });
  await page.waitForFunction(() => document.documentElement.dataset.fixed !== undefined, null, { timeout: 240000 }).catch(() => log('fix slow'));
  await frames(20); log('fix answered');
  if (await page.locator('#applypreview').count()) { await page.evaluate(() => document.querySelector('#applypreview')?.click()); await frames(40); log('applied'); }
  await page.click('#fitview').catch(() => {}); await frames(10);
  await page.mouse.move(640, 380);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -45); await frame(); }
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 45); await frame(); }
  log('editor');
};
