import { createStage } from './render/scene';
import { screenFor, startMusic } from './ui/music';
import { startCourse } from './modes/course';
import type { CourseData } from './course/course';
import { startDojo } from './modes/dojo';
import { initFeedback } from './ui/feedback';
import { mountSiteNav } from './ui/site-nav';
import { browserStore, startRedirect } from './ui/onboarding-flags';
import { installGalleryKeyGuard, mountWorldGallery, currentWorld, DEFAULT_PLACE, BUTTON_PLACE } from './ui/world-picker';
import { pageQuery, pageSearch } from './flags';
import { welcomeOn } from './ui/welcome-flags';

installGalleryKeyGuard(); // before any mode starts, so it sees every key first
// CC-246: a bare visit opens the welcome screen; a key or click there starts the First Course (?welcome=0 skips it)
if (welcomeOn({ params: pageQuery(), automated: navigator.webdriver })) {
  const { startWelcome } = await import('./modes/welcome');
  startWelcome(document.body);
  initFeedback('welcome');
  document.documentElement.dataset.ready = 'true';
  await new Promise<void>(() => {});
}
{ const r = startRedirect({ search: pageSearch(), store: browserStore, automated: navigator.webdriver }); if (r) { location.replace(r); await new Promise<void>(() => {}); } } // CC-100: a returning player goes back to their last course

// CC-219: a short link (?c=<id>) is turned into the words the page reads (course, challenge, look) before anything reads the address
if (pageQuery().has('c')) { const { expandShortSearch } = await import('./share/challenge'); const long = await expandShortSearch(pageSearch()); if (long) history.replaceState(null, '', location.pathname + long); }

// ?mode=dojo, ?mode=rookie, ?demo=rookie (the Rookie demo), ?demo=captured-vault (captured move review); the default is the Course.
if (pageQuery().get('demo') === 'captured-vault') {
  const { startCapturedVaultDemo } = await import('./modes/demo-captured-vault');
  await startCapturedVaultDemo();
} else if (pageQuery().get('demo') === 'welcome-tile') {
  const { startWelcomeTile } = await import('./modes/demo-welcome-tile');
  await startWelcomeTile();
} else if (pageQuery().get('demo') === 'rookie') {
  const { startRookieDemo } = await import('./modes/demo-rookie');
  await startRookieDemo();
} else if (pageQuery().get('demo') === 'poses') {
  const { startPoses } = await import('./modes/demo-poses');
  await startPoses();
} else if (pageQuery().get('demo') === 'hurt-ab') {
  const { startHurtAB } = await import('./modes/demo-poses');
  await startHurtAB();
} else if (pageQuery().get('demo') === 'roll-ab') {
  const { startRollAB } = await import('./modes/demo-roll-ab');
  await startRollAB();
} else if (pageQuery().get('demo') === 'actor') {
  const { startActorDemo } = await import('./modes/demo-actor');
  await startActorDemo();
} else {
// ?course=/assets/demo/lane-1.course.json opens a course file from this site (a lane cut from a 3D scene, for example)
async function courseFromUrl(): Promise<CourseData | undefined> {
  // ?generate=7 makes a course from seed 7 (a seed always gives the same course), every move proved clearable by the simulator
  const seed = pageQuery().get('generate');
  if (seed !== null && /^\d{1,9}$/.test(seed)) { const { generateCourse } = await import('./slice/generator'); return generateCourse(Number(seed)); }
  const track = pageQuery().get('coaster'); // ?coaster=0,9;7,5;14,1;... a track from the coaster builder
  if (track !== null) { const { coasterCourse, parseTrack } = await import('./slice/coaster'); const pts = parseTrack(track); if (pts) return coasterCourse('My coaster', pts, Number(pageQuery().get('push') ?? 1.5) || 1.5); }
  const made = pageQuery().get('made'); // CC-136: a course made in the editor, carried in the link
  if (made !== null) {
    const { shareOn } = await import('./share/challenge');
    // a saved share may hold a course up to 20000 characters (CC-219)
    if (shareOn(pageQuery())) { const { unpackCourse, SHARE_MAX_MADE_CHARS } = await import('./share/made-course'); const opened = await unpackCourse(made, SHARE_MAX_MADE_CHARS); if (opened) return opened; document.documentElement.dataset.madeRefused = '1'; return undefined; }
  }
  const cid = pageQuery().get('cid'); // CC-108: a challenge course by its id; the server holds it, the page cleans it again
  if (cid !== null && !pageQuery().has('course')) {
    const { challengeOn, cidOf } = await import('./share/challenge-course');
    const id = challengeOn(pageQuery()) ? cidOf(pageQuery()) : null;
    if (id) { const { openChallengeCourse } = await import('./share/challenge-client'); const got = await openChallengeCourse(id); if (got.course) return got.course; document.documentElement.dataset.challengeGone = got.gone ? 'gone' : 'missing'; return undefined; }
  }
  const url = pageQuery().get('course') ?? (pageQuery().get('pole') === '1' ? '/assets/experiments/pole/pole.course.json' : null); // CC-239: ?pole=1 plays the pole vault course
  if (!url || !/^\/assets\/[\w./-]+\.json$/.test(url)) return undefined;
  try { return (await (await fetch(url)).json()) as CourseData; } catch { return undefined; }
}
const mode = pageQuery().get('mode') ?? 'course';
const heroSlug = /^hero:([\w-]+)$/.exec(pageQuery().get('start') ?? '')?.[1]; // CC-238: the film's editor start scene
if (mode === 'editor' && heroSlug) { try { sessionStorage.setItem('cc.map.piece', JSON.stringify(await (await import('./slice/hero-start')).heroStart(heroSlug, fetch, pageQuery().get('box') === '1', Number(pageQuery().get('boxscale') ?? 1), Number(pageQuery().get('boxacross') ?? 0)))); } catch { /* the editor opens on its own world */ } }
<<<<<<< HEAD
const game = mode === 'diagrams' ? (await import('./modes/diagrams-page')).startDiagrams(document.body) : mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'editor' ? (await import('./modes/editor')).startEditor(document.body) : mode === 'map' ? (await import('./modes/map')).startMap(document.body) : mode === 'coaster' ? (await import('./modes/coaster')).startCoaster(document.body) : mode === 'lab-search' ? (await import('./modes/lab-search')).startLabSearch(document.body) : mode === 'lab-camera' ? (await import('./modes/lab-camera')).startLabCamera(document.body) : mode === 'lab-hashing' ? (await import('./modes/lab-hashing')).startLabHashing(document.body) : mode === 'lab-detector' ? (await import('./modes/lab-detector')).startLabDetector(document.body) : (mode === 'communities' || mode === 'gallery' || mode === 'park') ? (await import('./modes/community-flow')).startCommunityFlow(document.body, pageQuery()) : await startCourse(document.body, await courseFromUrl());
startMusic(screenFor(mode)); // CC-132: a loop per screen, only with ?music=1
if (mode !== 'course' && !(mode === 'dojo' && pageQuery().get('dojo') !== 'old')) mountWorldGallery(document.body, { current: currentWorld(pageQuery()), place: BUTTON_PLACE[mode] ?? DEFAULT_PLACE }); // CC-89: every other mode has the Courses button too (the Course mounts its own)
mountSiteNav(document.body, mode); // CC-246: one top bar with the four features on every page
document.documentElement.dataset.ready = 'true';
}
initFeedback(pageQuery().get('mode') ?? 'course');
