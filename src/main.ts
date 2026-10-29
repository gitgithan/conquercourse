import { createStage } from './render/scene';
import { startCourse } from './modes/course';
import type { CourseData } from './course/course';
import { startDojo } from './modes/dojo';
import { initFeedback } from './ui/feedback';
import { startPark } from './modes/park';
import { browserStore, startRedirect } from './ui/onboarding-flags';
import { installGalleryKeyGuard, mountWorldGallery, currentWorld, DEFAULT_PLACE, BUTTON_PLACE } from './ui/world-picker';

installGalleryKeyGuard(); // before any mode starts, so it sees every key first
{ const r = startRedirect({ search: location.search, store: browserStore, automated: navigator.webdriver }); if (r) { location.replace(r); await new Promise<void>(() => {}); } } // CC-100: a returning player goes back to their last course

// ?mode=dojo, ?mode=rookie, ?demo=rookie (the Rookie demo), ?demo=captured-vault (captured move review); the default is the Course.
if (new URLSearchParams(location.search).get('demo') === 'captured-vault') {
  const { startCapturedVaultDemo } = await import('./modes/demo-captured-vault');
  await startCapturedVaultDemo();
} else if (new URLSearchParams(location.search).get('demo') === 'rookie') {
  const { startRookieDemo } = await import('./modes/demo-rookie');
  await startRookieDemo();
} else if (new URLSearchParams(location.search).get('demo') === 'poses') {
  const { startPoses } = await import('./modes/demo-poses');
  await startPoses();
} else if (new URLSearchParams(location.search).get('demo') === 'hurt-ab') {
  const { startHurtAB } = await import('./modes/demo-poses');
  await startHurtAB();
} else if (new URLSearchParams(location.search).get('demo') === 'roll-ab') {
  const { startRollAB } = await import('./modes/demo-roll-ab');
  await startRollAB();
} else if (new URLSearchParams(location.search).get('demo') === 'actor') {
  const { startActorDemo } = await import('./modes/demo-actor');
  await startActorDemo();
} else {
// ?course=/assets/demo/lane-1.course.json opens a course file from this site (a lane cut from a 3D scene, for example)
async function courseFromUrl(): Promise<CourseData | undefined> {
  // ?generate=7 makes a course from seed 7 (a seed always gives the same course), every move proved clearable by the simulator
  const seed = new URLSearchParams(location.search).get('generate');
  if (seed !== null && /^\d{1,9}$/.test(seed)) { const { generateCourse } = await import('./slice/generator'); return generateCourse(Number(seed)); }
  const track = new URLSearchParams(location.search).get('coaster'); // ?coaster=0,9;7,5;14,1;... a track from the coaster builder
  if (track !== null) { const { coasterCourse, parseTrack } = await import('./slice/coaster'); const pts = parseTrack(track); if (pts) return coasterCourse('My coaster', pts, Number(new URLSearchParams(location.search).get('push') ?? 1.5) || 1.5); }
  const url = new URLSearchParams(location.search).get('course');
  if (!url || !/^\/assets\/[\w./-]+\.json$/.test(url)) return undefined;
  try { return (await (await fetch(url)).json()) as CourseData; } catch { return undefined; }
}
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'diagrams' ? (await import('./modes/diagrams-page')).startDiagrams(document.body) : mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'park' ? startPark(document.body) : mode === 'editor' ? (await import('./modes/editor')).startEditor(document.body) : mode === 'map' ? (await import('./modes/map')).startMap(document.body) : mode === 'coaster' ? (await import('./modes/coaster')).startCoaster(document.body) : mode === 'lab-search' ? (await import('./modes/lab-search')).startLabSearch(document.body) : mode === 'gallery' ? (await import('./modes/gallery')).startGallery(document.body) : await startCourse(document.body, await courseFromUrl());
document.documentElement.dataset.backend = game.backend;
if (mode !== 'course') mountWorldGallery(document.body, { current: currentWorld(new URLSearchParams(location.search)), place: BUTTON_PLACE[mode] ?? DEFAULT_PLACE }); // CC-89: every other mode has the Courses button too (the Course mounts its own)
document.documentElement.dataset.ready = 'true';
}
initFeedback(new URLSearchParams(location.search).get('mode') ?? 'course');
