// The shots of film version C. Each one is a real page of the product captured on the stepped clock by cap.mjs.
// A shot: { url, seconds, skip, ready, setup, frame, afterSkip, rate, track, cuts, moving }.
const READY = 'html[data-ready="true"]';
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// A run of a stored course played by the ideal plan (the same simulator and renderer as the game), clean screen, camera chosen by ?film=.
// `skip` runs the game silently to the moment the shot starts; film time restarts there, so camera moves begin on the first picture.
export function run({ course, film = 'clean', skip = 0, seconds = 3, extra = {}, track = true, rate, cuts }) {
  return {
    url: `?${q({ course: `/assets/demo/${course}.course.json`, bot: 'ideal', welcome: 0, film, music: 0, ...extra })}`,
    ready: READY, skip, seconds, rate, cuts,
    afterSkip: ({ page }) => page.evaluate(() => window.__filmZero?.()),
    track: track ? () => ({ x: window.__filmRunner?.x ?? 0, y: window.__filmRunner?.y ?? 0 }) : undefined,
  };
}

export const shots = {
  // timing probe
  probe: run({ course: 'training', film: 'clean', skip: 6, seconds: 2 }),

  // calm half: the hero course (Montmartre) from a fly-over to the side view, then the leap in slow motion
  hero_fly: run({ course: 'hero-montmartre-paris', film: 'flyover', seconds: 4.8, extra: { dur: 4.8 } }),
  hero_run: run({ course: 'hero-montmartre-paris', film: 'clean', skip: 7.4, seconds: 3.6 }),
  hero_leap: run({ course: 'hero-montmartre-paris', film: 'clean', skip: 9.6, seconds: 2.4, rate: (t) => (t > 0.5 && t < 1.7 ? 0.35 : 1) }),
  hero_catch: run({ course: 'hero-montmartre-paris', film: 'clean', skip: 10.88, seconds: 1.7 }),

  // fast half: one move or obstacle per shot, 1.7 s (four beats at 140 bpm)
  f_wall: run({ course: 'training', skip: 7.7, seconds: 1.7 }),
  f_vault: run({ course: 'lache', skip: 2.3, seconds: 1.7 }),
  f_hang: run({ course: 'training', skip: 17.3, seconds: 1.7 }),
  f_swing: run({ course: 'training', skip: 22.6, seconds: 1.7 }),
  f_bounce: run({ course: 'training', skip: 27.9, seconds: 1.7 }),
  f_plank: run({ course: 'plank', skip: 5.0, seconds: 1.7 }),
  f_balls: run({ course: 'cannonballs', skip: 8.2, seconds: 1.7 }),
  f_recoil: run({ course: 'recoil', skip: 3.6, seconds: 1.7 }),
  f_band: run({ course: 'band', skip: 6.6, seconds: 1.7 }),
  f_launch: run({ course: 'launch', skip: 3.0, seconds: 1.7 }),
  f_drone: run({ course: 'drone', skip: 1.5, seconds: 1.7 }),
  f_coaster: run({ course: 'coaster', skip: 1.5, seconds: 1.7 }),
  f_climb: run({ course: 'climb', skip: 7.6, seconds: 1.7 }),
  f_ghost: run({ course: 'training', skip: 4.4, seconds: 1.7, extra: { ghost: 'bot' } }),
  f_eyes: run({ course: 'park-run', film: 'eyesC', skip: 2.0, seconds: 3.4, extra: { dur: 3.4 } }),

  // the group photo and the end card
  lineup: { url: '?mode=lineup&welcome=0&music=0', ready: READY, seconds: 2.6, staticOk: true, moving: false },
  card: {
    url: '?mode=lineup&welcome=0&music=0', ready: READY, staticOk: true, moving: false,
    script: async (r) => {
      r.setVeil(`<img src="/brand/conquercourse-logo.svg" style="width:560px"><div style="color:#fff;font:800 54px system-ui;letter-spacing:.5px">Train slow. Run fast.</div>`, 1, '#0b0f0d');
      await r.hold(3.4);
    },
  },

  // the four features and the two lessons, each a short real moment of the page
  dojo: {
    url: '?mode=dojo&welcome=0&music=0', staticOk: true, moving: false,
    script: async (r) => {
      await r.page.waitForSelector('.dojo', { timeout: 120000 });
      r.caption('Train slow: learn a move by playing', 0.2, 3.4);
      await r.hold(0.5);
      const tab = r.page.getByText('Try it', { exact: true }).first();
      const tb = await tab.boundingBox().catch(() => null);
      if (tb) { await r.moveTo(tb.x + tb.width / 2, tb.y + tb.height / 2, 0.6); await r.press(); await tab.click().catch(() => {}); }
      await r.hold(0.3);
      const sl = await r.page.locator('input[type=range]').first().boundingBox().catch(() => null);
      if (sl) { await r.drag(sl.x + sl.width * 0.2, sl.y + sl.height / 2, sl.x + sl.width * 0.85, sl.y + sl.height / 2, 1.2); }
      await r.hold(Math.max(0.1, 3.6 - r.time));
    },
  },
  lab: {
    url: '?mode=lab-timing&labs=1&welcome=0&music=0', staticOk: true, moving: false,
    script: async (r) => {
      await r.page.waitForSelector('canvas, svg, input', { timeout: 120000 });
      r.caption('Labs: see why a rule is chosen', 0.2, 3.0);
      await r.hold(3.0);
    },
  },
  slicer: {
    url: '?mode=map&hooks=1&places=all&debug=places&welcome=0&music=0&flight=1', staticOk: true, moving: false,
    script: async (r) => {
      const pg = r.page;
      await pg.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 120000 });
      await pg.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 120000 }).catch(() => {});
      await pg.waitForSelector('#ready .card', { timeout: 60000 });
      await r.hold(0.3);
      r.caption('Slice a real place', 0.2, 4.6);
      await r.click('button[data-slug="montmartre-paris"]');
      await pg.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 60000 });
      await r.stepUntil(() => true, null, 1); await r.waitReal(() => true, null, 1000);
      await r.hold(1.4);
      await r.hold(0.8);
      await r.click('#slice');
      await r.hold(1.8); // the buildings rise
      await pg.click('#flightskip').catch(() => {});
      await r.stepUntil(() => document.documentElement.dataset.flightDone === '1', null, 120);
      await r.hold(Math.max(0.2, 4.8 - r.time));
    },
  },
  editor: {
    url: '?mode=editor&start=hero:montmartre-paris&welcome=0&music=0', staticOk: true, moving: false,
    script: async (r) => {
      await r.page.waitForSelector('#view3d', { timeout: 120000 });
      await r.page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Hide') b.click(); });
      r.caption('Build the course, with the Design partner', 0.2, 5.0);
      await r.hold(2.4);
      await r.click('#fitview').catch(() => {});
      await r.hold(2.4);
    },
  },
  community: {
    url: '?mode=communities&welcome=0&music=0', staticOk: true, moving: false,
    script: async (r) => {
      await r.page.waitForLoadState('networkidle').catch(() => {});
      r.caption('Play courses other people made', 0.2, 3.4);
      await r.moveTo(900, 420, 0.8);
      await r.hold(2.6);
    },
  },
};
