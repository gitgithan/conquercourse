import type { CourseData } from '../course/course';
import { clearedCached } from '../sim/ideal';
import { adviseLane, type LaneSetting } from './advice';
import { fixBars } from './fixbars';
import { fixLayout } from './fixit';
import type { P } from './holds-world';
import { proves } from './photo-proof';
import type { AgentReport } from './course-agent';
import { testLayout } from './course-agent-tools';
import type { Layout } from './layout-draft';

// The editor's slow questions, asked off the page's thread (CC-70): Fix it, the advice, "does this lane clear?", "does this draft clear?".
// Their budgets count simulated ticks (src/sim/ideal.ts: workSeconds), so a slow machine gives the same answer a little later.
export type ProofRequest =
  | { kind: 'fix'; pieces: P[]; lane: LaneSetting; movable?: number[] }
  | { kind: 'bars'; pieces: P[]; lane: LaneSetting; budget?: number }
  | { kind: 'advice'; pieces: P[]; lane: LaneSetting; budget?: number }
  | { kind: 'cleared'; course: CourseData }
  | { kind: 'proves'; pieces: P[]; lane: LaneSetting }
  | { kind: 'agentTest'; layout: Layout };

export function answer(r: ProofRequest): unknown {
  switch (r.kind) {
    case 'fix': return fixLayout(r.pieces, r.lane, undefined, undefined, r.movable ? { movable: r.movable } : {});
    case 'bars': return fixBars(r.pieces, r.lane, r.budget);
    case 'advice': return adviseLane(r.pieces, r.lane, { budget: r.budget });
    case 'cleared': return clearedCached(r.course);
    case 'proves': return proves(r.pieces, r.lane);
    case 'agentTest': return testLayout(r.layout) satisfies AgentReport;
  }
}
