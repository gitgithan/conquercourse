export default async ({ page, frame, frames, log, url }) => {
  for (const [name, q] of [['dojo', '?mode=dojo&welcome=0'], ['lab', '?mode=lab-optimization&labs=1&welcome=0'], ['comm', '?mode=communities&welcome=0'], ['gal', '?mode=gallery&welcome=0'], ['home', '?welcome=0']]) {
    await page.goto(url(q)); await page.waitForTimeout(6000); await frames(1); log(name);
  }
};
