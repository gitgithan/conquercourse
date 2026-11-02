import { NO_INPUT, type RunnerInput } from '../../sim/runner';
import { inputOfMask, type InputLog } from '../../sim/replay';

export interface Feed { log: InputLog; i: number; left: number }

// Share (CC-128, CC-129): keys fed from a link play the run again; while a clip is made the game is stepped by hand and nothing is counted or heard.
export function createFeed() {
  let feed: Feed | null = null;
  const fedInput = (): RunnerInput => {
    while (feed && feed.left === 0 && feed.i < feed.log.length) { feed.left = feed.log[feed.i][1]; feed.i++; }
    if (!feed || feed.left === 0) return NO_INPUT;
    feed.left--;
    return inputOfMask(feed.log[feed.i - 1][0]);
  };
  return { active: () => feed !== null, input: fedInput, set: (f: Feed | null) => { feed = f; }, play: (log: InputLog) => { feed = { log, i: 0, left: 0 }; } };
}
