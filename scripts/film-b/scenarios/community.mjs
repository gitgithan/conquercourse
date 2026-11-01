export default async ({ page, frames, frame, log, url }) => {
  await page.goto(url('?mode=communities&welcome=0')); await page.waitForSelector('text=Play this course', { timeout: 120000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Feedback').forEach((b) => (b.style.display = 'none')));
  await frames(6);
  await page.mouse.move(640, 420);
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 14); await frame(); }
  log('scrolled down');
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, -14); await frame(); }
  log('community');
};
