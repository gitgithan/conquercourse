import { createStage } from './render/scene';
import { startCourse } from './modes/course';
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
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'diagrams' ? (await import('./modes/diagrams-page')).startDiagrams(document.body) : mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'park' ? startPark(document.body) : mode === 'gallery' ? (await import('./modes/gallery')).startGallery(document.body) : await startCourse(document.body);
document.documentElement.dataset.backend = game.backend;
document.documentElement.dataset.ready = 'true';
}
initFeedback(new URLSearchParams(location.search).get('mode') ?? 'course');
