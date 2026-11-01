const CSS = 'button.fb,#cc-feedback-btn,.feedback,[class*=feedback]{display:none !important}';
export default async ({ page, frames, frame, log, url }) => {
  await page.goto(url('?mode=dojo&welcome=0')); await page.waitForSelector('.steps .node', { timeout: 120000 });
  await page.addStyleTag({ content: CSS }); await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Feedback').forEach((b) => (b.style.display = 'none')));
  await frames(12);
  await page.locator('.steps .node').nth(1).click(); await frames(8); log('try it');
  for (let i = 0; i < 44; i++) {
    await page.evaluate((u) => { const r = document.querySelector('input[id^=knob-]'); if (!r) return; const a = Number(r.min), b = Number(r.max); r.value = String(a + (b - a) * (0.25 + 0.6 * u)); r.dispatchEvent(new Event('input', { bubbles: true })); }, i / 43);
    await frame();
  }
  await frames(8); log('dojo');
};
