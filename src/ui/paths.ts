// Forks on the screen (CC-225), behind ?paths=1: the fork on the key strip, and the way taken in the end report.
// Facts only: which way you took and how long each way takes at best. Nothing is graded, and the two ways are never ranked as better or worse.
import type { CourseData } from '../course/course';
import { branchesOf, routeOfPath, type Branch, type BranchRoute } from '../sim/branches';
import type { Plan } from '../sim/ideal';
import { ZONE_ICONS } from './zone-icons';

export const pathsOn = (p: URLSearchParams): boolean => { const search = p; return p.get('paths') === '1' || search.get('fork') !== '0'; }; // fork=1 (CC-133) turns the same fork display on

export interface WayRow { id: string; name: string; seconds: number; effort: number | null; roomMs: number | null; mine: boolean }
export interface Ways { branch: string; taken: string | null; takenPlan: Plan | null; rows: WayRow[] }

const shortName = (r: BranchRoute): string => r.name.split(':')[0];

/** The ways of the first fork and which one this run took (null when the run never got past the join, or started after the fork). */
export function waysOf(course: CourseData, path: { x: number; y: number }[]): Ways | null {
  const b: Branch | undefined = branchesOf(course)[0];
  if (!b) return null;
  const taken = routeOfPath(b, path);
  return {
    branch: b.name,
    taken: taken?.id ?? null,
    takenPlan: taken?.plan ?? null,
    rows: b.routes.filter((r) => r.ticks !== undefined).map((r) => ({ id: r.id, name: shortName(r), seconds: r.ticks! / 120, effort: r.effort ?? null, roomMs: r.narrowestMs ?? null, mine: r.id === taken?.id })),
  };
}

/** The room for error in plain words: the narrowest window of good presses on the way. */
export const roomText = (ms: number | null): string => (ms === null ? '' : `${(ms / 1000).toFixed(2)} s`);

/** The fork as one cell of the key strip: a row of icons for each way, so the choice is seen before the fork. */
export function forkCell(b: Branch): string {
  const row = (r: BranchRoute) => `<span style="display:flex;gap:3px;align-items:center;white-space:nowrap">${r.icons.map((i) => `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ZONE_ICONS[i] ?? '<circle cx="16" cy="16" r="6"/>'}</svg>`).join('')}<span style="font-weight:600">${shortName(r)}</span></span>`;
  return `<span class="fork" style="display:grid;gap:2px;padding:4px 8px;border:2px solid #9aa59e;border-radius:12px;background:#fff;color:#58635d"><b style="font-size:11px">${b.name}: pick a way</b>${b.routes.map(row).join('')}</span>`;
}
