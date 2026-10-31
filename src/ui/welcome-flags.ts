import { isReturning, type Store } from './onboarding-flags';

// The welcome screen (CC-246): the rules for who sees it, in one pure place so a unit test can walk every case.
// A bare visit sees it; any link that names a mode, a course or anything else is an explicit link and is left alone.
export const WELCOME_ON = true; // the build switch; ?welcome=0 turns it off for one visit

/** Query words a bare visit may carry and still get the welcome screen. */
const QUIET = new Set(['welcome', 'onboarding', 'labs', 'cam', 'photos']);

export interface WelcomeIn { params: URLSearchParams; automated: boolean; build?: boolean }

/** True when the welcome screen opens instead of a course. Test runs and films bypass it unless they ask with ?welcome=1. */
export function welcomeOn(o: WelcomeIn): boolean {
  if (!(o.build ?? WELCOME_ON)) return false;
  const w = o.params.get('welcome');
  if (w === '0') return false;
  if (o.automated && w !== '1') return false;
  const mode = o.params.get('mode');
  if (mode && mode !== 'course') return false;
  for (const k of o.params.keys()) if (!QUIET.has(k)) return false;
  return true;
}

/** Where a key or click on the welcome screen goes: the First Course (the stock course, never the Training course). A first visit gets its short tour. */
export function startHref(store: Store): string {
  return isReturning(store) ? '?welcome=0' : '?welcome=0&tour=1';
}
