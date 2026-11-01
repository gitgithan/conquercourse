import { readFileSync } from 'node:fs';
export default async ({ page, frame, log }) => {
  const svg = readFileSync('public/brand/conquercourse-logo.svg', 'utf8');
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  await page.setContent(`<body style="margin:0;background:#14181f;display:grid;place-items:center;height:100vh;font-family:DejaVu Sans,system-ui,sans-serif"><div style="text-align:center"><img src="${uri}" style="width:760px;display:block;margin:0 auto"><div style="color:#f4efe6;font-size:44px;font-weight:700;letter-spacing:1px;margin-top:6px">Train slow. Run fast.</div></div></body>`);
  await page.waitForTimeout(500); await page.evaluate(() => { window.__stepClock = () => 0; }); await frame(); log('logo card');
};
