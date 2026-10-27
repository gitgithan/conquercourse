import { createStage } from './render/scene';
import { startCourse } from './modes/course';
import { startDojo } from './modes/dojo';

// ?mode=dojo, ?mode=rookie; the default is the Course.
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'rookie' ? await createStage(document.body) : mode === 'dojo' ? startDojo(document.body) : await startCourse(document.body);
document.documentElement.dataset.backend = game.backend;
document.documentElement.dataset.ready = 'true';
