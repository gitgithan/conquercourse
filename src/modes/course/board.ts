import type { CourseData } from '../../course/course';
import type { BoardHooks } from '../../ui/leaderboard';
import type { Ghost } from '../../ui/ghost';
import { chaseRun, loadRun, openRunView } from '../../ui/run-view';

// CC-108: View Run, then Race Ghost. The ghost is read when a button is pressed, so it is an accessor.
export function createViewHooks(course: CourseData, ghost: () => Ghost | null): BoardHooks {
  return {
    onView: (row) => { if (row.id) void openRunView(course, { id: row.id, nick: row.nick, ticks: row.ticks }, (t, nick) => ghost()?.setFriend(t, nick)); },
    onChase: (row) => { if (row.id) void chaseRun(course, { id: row.id, nick: row.nick, ticks: row.ticks }, (t, nick) => ghost()?.setFriend(t, nick)); },
    onStats: async (row) => { const r = row.id ? await loadRun(course, row.id) : null; return r ? { moves: r.moves } : null; },
  };
}
