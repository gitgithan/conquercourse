// Test helper only (CC-219): the address a page reads after a short link is opened (?course=..., ?made=..., ?challenge=...), built without a server.
// The game itself makes only short links; this lets a test look at the challenge text and the kept words.
import type { CourseData } from '../../src/course/course';
import { prepareShare } from '../../src/share/challenge';
import type { ChallengeKind, InputLog } from '../../src/sim/replay';

export async function expandedAddress(origin: string, search: string, course: CourseData, log: InputLog, nick = '', look: 'a' | 'b' = 'a', kind: ChallengeKind = 'done', start = 0): Promise<string | null> {
  const p = await prepareShare(search, course, log, nick, kind, start);
  if (!p) return null;
  const to = p.keep;
  if (p.made) to.set('made', p.made);
  to.set('challenge', p.param);
  to.set('c', 'abcdefghjk'); // the marker the page needs to open a challenge (any short-id shape; a test never asks the server)
  if (look === 'b') to.set('rk', 'b');
  return `${origin}/?${to.toString()}`;
}
