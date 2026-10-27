import { createStage } from './render/scene';
import { startCourse } from './modes/course';

// ?mode=rookie shows the character alone; the default is the Course.
const mode = new URLSearchParams(location.search).get('mode') ?? 'course';
const game = mode === 'rookie' ? await createStage(document.body) : await startCourse(document.body);
document.documentElement.dataset.backend = game.backend;
document.documentElement.dataset.ready = 'true';
