export default async ({ page, frames, frame, log, url }) => {
  await page.goto(url('?mode=lab-ik&labs=1&welcome=0')); await page.waitForSelector('#ik-pic', { timeout: 120000 });
  await page.addStyleTag({ content: 'button.fb,#cc-feedback-btn,.feedback,[class*=feedback]{display:none !important}' });
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Feedback').forEach((b) => (b.style.display = 'none')));
  await page.locator('#ik-pic').scrollIntoViewIfNeeded();
  await frames(4);
  const b = await page.locator('#ik-pic').boundingBox();
  const at = (a, r) => [b.x + b.width * (0.52 + r * Math.cos(a)), b.y + b.height * (0.42 + r * 1.3 * Math.sin(a))];
  const [x0, y0] = at(0, 0.2);
  await page.mouse.move(x0, y0); await page.mouse.down(); await frame();
  for (let i = 1; i <= 90; i++) { const [x, y] = at((i / 90) * Math.PI * 2, 0.2 - 0.05 * Math.sin((i / 90) * Math.PI)); await page.mouse.move(x, y); await frame(); }
  await page.mouse.up(); log('lab ik');
};
