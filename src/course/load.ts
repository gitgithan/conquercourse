import type { CourseData } from './course';
export async function courseFromUrl(params: URLSearchParams): Promise<CourseData | undefined> {
  // ?generate=7 makes a course from seed 7 (a seed always gives the same course), every move proved clearable by the simulator
  const seed = params.get('generate');
  if (seed !== null && /^\d{1,9}$/.test(seed)) { const { generateCourse } = await import('../slice/generator'); return generateCourse(Number(seed)); }
  const track = params.get('coaster'); // ?coaster=0,9;7,5;14,1;... a track from the coaster builder
  if (track !== null) { const { coasterCourse, parseTrack } = await import('../slice/coaster'); const pts = parseTrack(track); if (pts) return coasterCourse('My coaster', pts, Number(params.get('push') ?? 1.5) || 1.5); }
  const made = params.get('made'); // CC-136: a course made in the editor, carried in the link
  if (made !== null) {
    const { shareOn } = await import('../share/challenge');
    // a saved share may hold a course up to 20000 characters (CC-219)
    if (shareOn(params)) { const { unpackCourse, SHARE_MAX_MADE_CHARS } = await import('../share/made-course'); const opened = await unpackCourse(made, SHARE_MAX_MADE_CHARS); if (opened) return opened; document.documentElement.dataset.madeRefused = '1'; return undefined; }
  }
  const cid = params.get('cid'); // CC-108: a challenge course by its id; the server holds it, the page cleans it again
  if (cid !== null && !params.has('course')) {
    const { challengeOn, cidOf } = await import('../share/challenge-course');
    const id = challengeOn(params) ? cidOf(params) : null;
    if (id) { const { openChallengeCourse } = await import('../share/challenge-client'); const got = await openChallengeCourse(id); if (got.course) return got.course; document.documentElement.dataset.challengeGone = got.gone ? 'gone' : 'missing'; return undefined; }
  }
  const url = params.get('course') ?? (params.get('pole') === '1' ? '/assets/experiments/pole/pole.course.json' : null); // CC-239: ?pole=1 plays the pole vault course
  if (!url || !/^\/assets\/[\w./-]+\.json$/.test(url)) return undefined;
  try { const response = await fetch(url); if (!response.ok) return undefined; return await response.json() as CourseData; } catch { return undefined; }
}
