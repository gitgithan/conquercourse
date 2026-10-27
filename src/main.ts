import { createStage } from './render/scene';
import { startCourse } from './modes/course';
import type { CourseData } from './course/course';
import { startDojo } from './modes/dojo';
import { initFeedback } from './ui/feedback';
import { startPark } from './modes/park';

// ?mode=dojo, ?mode=rookie, ?demo=rookie (the Rookie demo); the default is the Course.
if (new URLSearchParams(location.search).get('demo') === 'rookie') {
  const { startRookieDemo } = await import('./modes/demo-rookie');
  await startRookieDemo();
} else if (new URLSearchParams(location.search).get('demo') === 'actor') {
  const { startActorDemo } = await import('./modes/demo-actor');
  await startActorDemo();
} else {
// ?course=/assets/demo/lane-1.course.json opens a course file from this site (a lane cut from a 3D scene, for example)
async function courseFromUrl(): Promise<CourseData | undefined> {
  // ?generate=7 makes a course from seed 7 (a seed always gives the same course), every move proved clearable by the simulator
  const seed = new URLSearchParams(location.search).get('generate');
  if (seed !== null && /^\d{1,9}$/.test(seed)) { const { generateCourse } = await import('./slice/generator'); return generateCourse(Number(seed)); }
  const url = new URLSearchParams(location.search).get('course');
  if (!url || !/^\/assets\/[\w./-]+\.json$/.test(url)) return undefined;
  try { return (await (await fetch(url)).json()) as CourseData; } catch { return undefined; }
}
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'diagrams' ? (await import('./modes/diagrams-page')).startDiagrams(document.body) : mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'park' ? startPark(document.body) : mode === 'editor' ? (await import('./modes/editor')).startEditor(document.body) : mode === 'map' ? (await import('./modes/map')).startMap(document.body) : mode === 'gallery' ? (await import('./modes/gallery')).startGallery(document.body) : await startCourse(document.body, await courseFromUrl());
document.documentElement.dataset.backend = game.backend;
document.documentElement.dataset.ready = 'true';
}
initFeedback(new URLSearchParams(location.search).get('mode') ?? 'course');
