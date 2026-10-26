import { createStage } from './render/scene';

const stage = await createStage(document.body);
document.documentElement.dataset.backend = stage.backend;
document.documentElement.dataset.ready = 'true';
