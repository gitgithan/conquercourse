export default async ({ page, frames, log, url }) => {
  await page.goto(url('?demo=group&welcome=0&dur=3'));
  await page.waitForSelector('html[data-ready=true]', { timeout: 240000 });
  await page.addStyleTag({ content: 'button, #feedback, .feedback, [class*=feedback]{display:none !important}' });
  await frames(72); log('group');
};
