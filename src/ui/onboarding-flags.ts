import { QUIET_WORDS } from '../switches';
// Who gets the first-visit tour (CC-100): the rules in one pure place, so a unit test can walk every case.
// A first visit gets the tour; a returning player gets their last course; automation and explicit links keep today's behaviour.
export const ONBOARDING_ON = true; // the build switch; ?onboarding=0 turns it off for one visit
export const FIRST_COURSE_ID = '/assets/demo/training.course.json'; // the Training course (CC-97); '' would mean the stock course
export const TOUR_STEP_S = 4.5; // each tour step moves on by itself after this long (6 steps: 27 s)

export const TOUR_DONE = 'cc.tour.done';
export const NEXT_SEEN = 'cc.next.seen';
export const FALL_SEEN = 'cc.firstFall.seen';
export const LAST_COURSE = 'cc.lastCourse';
const OLD_WELCOME = 'cc.worldWelcome.seen'; // players who saw the old world chooser are returning players

/** The only query words a plain first visit may carry; any other one is an explicit link and is left alone. */
const QUIET = QUIET_WORDS;

export interface Store { get(key: string): string | null; set(key: string, value: string): void }
export const browserStore: Store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* the tour still works without storage */ } },
};

export const onboardingOn = (params: URLSearchParams, build = ONBOARDING_ON): boolean => build && params.get('onboarding') !== '0';
export const isReturning = (store: Store): boolean => store.get(TOUR_DONE) === '1' || store.get(OLD_WELCOME) === '1';

export interface TourIn { params: URLSearchParams; store: Store; automated: boolean; mode?: string | null; resume?: boolean; build?: boolean }

/** 'tour' when the guided tour should open now. */
export function tourDecision(o: TourIn): 'tour' | 'none' {
  if (!onboardingOn(o.params, o.build)) return 'none';
  if (o.mode && o.mode !== 'course') return 'none';
  if (o.resume) return 'none';
  if (o.params.has('bot') || o.params.has('demo') || o.params.has('startx')) return 'none'; // films, checks and tests
  if (o.params.get('tour') === '1') return 'tour'; // forced, for testing and for a shared "start here" link
  if (o.automated) return 'none';
  for (const k of o.params.keys()) if (!QUIET.has(k)) return 'none';
  return isReturning(o.store) ? 'none' : 'tour';
}

const SAFE_COURSE = /^\/assets\/[\w\-./]+\.course\.json$/;

/** Where a bare visit should go instead (a returning player's last course, the first course on a first visit), or null to stay. */
export function startRedirect(o: { search: string; store: Store; automated: boolean; build?: boolean }): string | null {
  const params = new URLSearchParams(o.search);
  if (!onboardingOn(params, o.build) || o.automated) return null;
  const mode = params.get('mode');
  if (mode && mode !== 'course') return null;
  if (params.get('tour') === '1') return null;
  for (const k of params.keys()) if (!QUIET.has(k)) return null; // an explicit link stays as it is
  if (isReturning(o.store)) {
    const last = o.store.get(LAST_COURSE);
    if (last && SAFE_COURSE.test(last)) return `?course=${last}&welcome=0`;
    return FIRST_COURSE_ID && SAFE_COURSE.test(FIRST_COURSE_ID) ? `?course=${FIRST_COURSE_ID}&welcome=0` : null; // a returning player with no last course starts on the Training course too
  }
  return FIRST_COURSE_ID && SAFE_COURSE.test(FIRST_COURSE_ID) ? `?course=${FIRST_COURSE_ID}&tour=1` : null;
}

export const rememberCourse = (store: Store, params: URLSearchParams): void => {
  const c = params.get('course');
  if (c && SAFE_COURSE.test(c)) store.set(LAST_COURSE, c);
};
