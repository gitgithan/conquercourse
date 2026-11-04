// CC-108: the courses a run can be published on. One list, read by the server (what it accepts), the Course page (what it offers) and the Courses cards (where the Leaderboard link goes).
// The key is the name the server and the stats use: a demo file 'public/assets/demo/<name>.course.json' is 'demo/<name>'; the First Course lives in the source, so it has its own key.
export interface BoardCourse { key: string; name: string; path: string | null } // path: the ?course= value that opens it; null for the First Course (no ?course=)

export const BOARD_COURSES: BoardCourse[] = [
  { key: 'default/first', name: 'First Course', path: null },
  { key: 'demo/training', name: 'Training Course', path: '/assets/demo/training.course.json' },
  { key: 'demo/cannonballs', name: 'Cannonballs', path: '/assets/demo/cannonballs.course.json' },
  { key: 'demo/two-ways', name: 'Two ways', path: '/assets/demo/two-ways.course.json' },
  { key: 'demo/fork-bench-bulb', name: 'Benches or bulbs', path: '/assets/demo/fork-bench-bulb.course.json' }, // CC-133: the fork, climb the pole and swing the bulb bars, or run and jump the bench floor
];

export const FIRST_COURSE_KEY = 'default/first';
export const isBoardKey = (key: string): boolean => BOARD_COURSES.some((c) => c.key === key);
export const boardNameOf = (key: string): string => BOARD_COURSES.find((c) => c.key === key)?.name ?? key;
export const boardPathOf = (key: string): string | null => BOARD_COURSES.find((c) => c.key === key)?.path ?? null;

/** The board key of the page being played: the ?course= file when it is listed, the First Course when there is no ?course= and no mode, otherwise null. */
export function boardKeyOfPage(params: URLSearchParams): string | null {
  if (params.get('mode')) return null;
  const path = params.get('course');
  if (!path) return FIRST_COURSE_KEY;
  return BOARD_COURSES.find((c) => c.path === path)?.key ?? null;
}
