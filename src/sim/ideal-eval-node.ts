import { parentPort } from 'node:worker_threads';
import { makeHandler } from './ideal-eval';

// A worker thread of the ideal-run pool for Node (tests, `npm run plans`, the benchmark).
const handle = makeHandler((m) => parentPort!.postMessage(m));
parentPort!.on('message', handle);
