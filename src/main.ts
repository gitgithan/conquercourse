import { createStage } from './render/scene';
import { startCourse } from './modes/course';
import { startDojo } from './modes/dojo';
import { startPark } from './modes/park';

// ?mode=dojo, ?mode=rookie, ?demo=rookie (the Rookie demo); the default is the Course.
if (new URLSearchParams(location.search).get('demo') === 'rookie') {
  const { startRookieDemo } = await import('./modes/demo-rookie');
  await startRookieDemo();
} else {
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : mode === 'park' ? startPark(document.body) : await startCourse(document.body);
document.documentElement.dataset.backend = game.backend;
document.documentElement.dataset.ready = 'true';
}
