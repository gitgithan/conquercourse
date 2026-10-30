import { createStage } from './render/scene';
import { screenFor, startMusic } from './ui/music';
import { startCourse } from './modes/course';
import type { CourseData } from './course/course';
import { startDojo } from './modes/dojo';
import { initFeedback } from './ui/feedback';
import { startPark } from './modes/park';
import { browserStore, startRedirect } from './ui/onboarding-flags';
import { installGalleryKeyGuard, mountWorldGallery, currentWorld, DEFAULT_PLACE, BUTTON_PLACE } from './ui/world-picker';
import { pageQuery, pageSearch } from './flags';

installGalleryKeyGuard(); // before any mode starts, so it sees every key first
{ const r = startRedirect({ search: pageSearch(), store: browserStore, automated: navigator.webdriver }); if (r) { location.replace(r); await new Promise<void>(() => {}); } } // CC-100: a returning player goes back to their last course

// CC-219: a short link (?c=<id>) is turned into the long form before anything reads the address; the page then works as it does for a long link
if (pageQuery().has('c')) { const { expandShortSearch } = await import('./share/challenge'); const long = await expandShortSearch(pageSearch()); if (long) history.replaceState(null, '', location.pathname + long); }

// ?mode=dojo, ?mode=rookie, ?demo=rookie (the Rookie demo), ?demo=captured-vault (captured move review); the default is the Course.
if (pageQuery().get('demo') === 'captured-vault') {
  const { startCapturedVaultDemo } = await import('./modes/demo-captured-vault');
  await startCapturedVaultDemo();
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
    if (shareOn(pageQuery())) { const { unpackCourse } = await import('./share/made-course'); const opened = await unpackCourse(made); if (opened) return opened; document.documentElement.dataset.madeRefused = '1'; return undefined; }
  }
  const url = pageQuery().get('course');
  if (!url || !/^\/assets\/[\w./-]+\.json$/.test(url)) return undefined;
  try { return (await (await fetch(url)).json()) as CourseData; } catch { return undefined; }
}
const mode = pageQuery().get('mode') ?? 'course';
const heroSlug = /^hero:([\w-]+)$/.exec(pageQuery().get('start') ?? '')?.[1]; // CC-238: the film's editor start scene
if (mode === 'editor' && heroSlug) { try { sessionStorage.setItem('cc.map.piece', JSON.stringify(await (await import('./slice/hero-start')).heroStart(heroSlug, fetch, pageQuery().get('box') === '1', Number(pageQuery().get('boxscale') ?? 1), Number(pageQuery().get('boxacross') ?? 0)))); } catch { /* the editor opens on its own world */ } }
const game = mode === 'diagrams' ? (await import('./modes/diagrams-page')).startDiagrams(document.body) : mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'park' ? startPark(document.body) : mode === 'editor' ? (await import('./modes/editor')).startEditor(document.body) : mode === 'map' ? (await import('./modes/map')).startMap(document.body) : mode === 'coaster' ? (await import('./modes/coaster')).startCoaster(document.body) : mode === 'lab-search' ? (await import('./modes/lab-search')).startLabSearch(document.body) : mode === 'gallery' ? (await import('./modes/gallery')).startGallery(document.body) : await startCourse(document.body, await courseFromUrl());
document.documentElement.dataset.backend = game.backend;
startMusic(screenFor(mode)); // CC-132: a loop per screen, only with ?music=1
if (mode !== 'course' && !(mode === 'dojo' && pageQuery().get('dojo') !== 'old')) mountWorldGallery(document.body, { current: currentWorld(pageQuery()), place: BUTTON_PLACE[mode] ?? DEFAULT_PLACE }); // CC-89: every other mode has the Courses button too (the Course mounts its own)
document.documentElement.dataset.ready = 'true';
}
initFeedback(pageQuery().get('mode') ?? 'course');
