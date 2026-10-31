// Numbers on the course cards and the difficulty order (CC-149). How the order is worked out is written in docs/course-stats.md; the maths never shows on screen.
// Plays are run starts (a rough count). A clear is a run the server played again with the simulator. No person is counted.

/** The name the server and the course page use for a card's course path: '/assets/demo/training.course.json' becomes 'demo/training'. */
export const statKey = (path: string): string => path.replace(/^\/assets\//, '').replace(/\.course\.json$/, '').replace(/[^a-zA-Z0-9_/-]/g, '-');

/** Build switch; ?stats=0 turns the numbers off for one visit. */
export const STATS_ON = true;
export const statsOn = (params: URLSearchParams, build = STATS_ON): boolean => build && params.get('stats') !== '0';

export interface CourseNumbers { plays: number; fails: number; clears: number; best: number | null; median: number | null; today?: number }
export interface CourseMeta { obstacles: number; idealTicks: number | null }

export const TICKS_PER_SECOND = 120;
/** Attempts worth of belief in the designer's order: with this many attempts the data and the designer count the same. */
export const PRIOR_ATTEMPTS = 20;
/** Fewest attempts (clears + failures) before a card shows a difficulty label from data. */
export const MIN_ATTEMPTS_SHOWN = 5;
const FAIL_PER_OBSTACLE_HARD = 0.35; // a chance this high to fail at each obstacle is the hardest the scale goes
const LOST_SECONDS_HARD = 5; // five seconds lost to the best line at each obstacle is the hardest the scale goes
const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));

/** The designer's guess for a course: its place in the menu's group, from 0.1 (first) to 0.9 (last). */
export const priorScore = (rank: number, groupSize: number): number => (groupSize <= 1 ? 0.5 : 0.1 + 0.8 * (rank / (groupSize - 1)));

/** 0 (easy) to 1 (hard) from what players did, or null when nobody has finished or failed yet. */
export function observedScore(n: CourseNumbers, meta: CourseMeta): number | null {
  const attempts = n.clears + n.fails;
  if (attempts <= 0) return null;
  const obstacles = Math.max(1, meta.obstacles);
  const failRate = clamp(n.fails / attempts, 0, 0.999); // a run fails at one obstacle or clears them all: the chance per obstacle, spread over the course
  const perObstacle = 1 - Math.pow(1 - failRate, 1 / obstacles);
  const failPart = clamp(perObstacle / FAIL_PER_OBSTACLE_HARD);
  if (n.median === null || meta.idealTicks === null) return failPart; // no best line to compare the time with
  const lost = Math.max(0, n.median - meta.idealTicks) / TICKS_PER_SECOND / obstacles;
  const timePart = clamp(lost / LOST_SECONDS_HARD);
  return 0.65 * failPart + 0.35 * timePart;
}

/** The score used to order cards: the data's score and the designer's, weighted by how many attempts there are. */
export function difficulty(n: CourseNumbers | undefined, meta: CourseMeta | undefined, prior: number): { score: number; fromData: boolean } {
  if (!n || !meta) return { score: prior, fromData: false };
  const seen = observedScore(n, meta);
  if (seen === null) return { score: prior, fromData: false };
  const attempts = n.clears + n.fails, w = attempts / (attempts + PRIOR_ATTEMPTS);
  return { score: w * seen + (1 - w) * prior, fromData: attempts >= MIN_ATTEMPTS_SHOWN };
}

/** One to four dots from a score. */
export const dotsOf = (score: number): number => 1 + Math.min(3, Math.floor(clamp(score) * 4));
export const DIFFICULTY_WORDS = ['', 'Easy', 'Medium', 'Hard', 'Very hard'];

const thousands = (n: number): string => n.toLocaleString('en-US');
export const secondsText = (ticks: number): string => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;
/** "12 plays today · 1,204 all time, 311 cleared, best 41.2 s" (without today's count from the server: "1,204 plays, 311 cleared, best 41.2 s"). A part with nothing to say is left out, and no data at all gives null (never a made-up number). */
export function statsLine(n: CourseNumbers | undefined): string | null {
  if (!n || (n.plays <= 0 && n.clears <= 0)) return null;
  const parts: string[] = [];
  const today = n.today ?? 0;
  if (n.plays > 0 && n.today !== undefined) parts.push(`${thousands(today)} ${today === 1 ? 'play' : 'plays'} today \u00b7 ${thousands(n.plays)} all time`); // zero today is said too
  else if (n.plays > 0) parts.push(`${thousands(n.plays)} ${n.plays === 1 ? 'play' : 'plays'}`);
  if (n.clears > 0) parts.push(`${thousands(n.clears)} cleared`);
  if (n.best !== null && n.clears > 0) parts.push(`best ${secondsText(n.best)}`);
  return parts.join(', ');
}

export interface StatChip { key: 'today' | 'plays' | 'clears' | 'best' | 'typical' | 'falls' | 'none'; icon: string; value: string; label: string; tip: string }
/** Every number the server sends for a card, in one fixed order: today, all time, cleared, best, typical, falls. A chip is left out only when its number is missing; a course nobody has played gets the one friendly chip. */
export function statChips(n: CourseNumbers | undefined): StatChip[] {
  if (!n || (n.plays <= 0 && n.clears <= 0)) return [{ key: 'none', icon: '\u2728', value: 'No plays yet', label: 'be the first', tip: 'Nobody has run this course yet' }];
  const chips: StatChip[] = [];
  if (n.today !== undefined) chips.push({ key: 'today', icon: '\u{1F525}', value: thousands(n.today), label: 'today', tip: 'Runs started today (since midnight UTC)' });
  chips.push({ key: 'plays', icon: '\u25B6', value: thousands(n.plays), label: 'all time', tip: 'Runs started, ever (a rough count)' });
  chips.push({ key: 'clears', icon: '\u2705', value: thousands(n.clears), label: 'cleared', tip: 'Runs that reached the end and were played again by the server to check' });
  if (n.best !== null && n.clears > 0) chips.push({ key: 'best', icon: '\u23F1', value: secondsText(n.best), label: 'best', tip: 'The fastest checked clear' });
  if (n.median !== null && n.clears > 0) chips.push({ key: 'typical', icon: '\u{1F4CA}', value: secondsText(n.median), label: 'typical', tip: 'The middle clear time: half of the clears were faster' });
  chips.push({ key: 'falls', icon: '\u{1F4A5}', value: thousands(n.fails), label: 'falls', tip: 'Runs that ended in a fall or a hit' });
  return chips;
}

export interface CardStat { value: string; key: string; rank: number; groupSize: number }
/** Cards of one group, easiest first. Ties keep the menu order, so a group with no data stays as the designer set it. */
export function orderByDifficulty(cards: CardStat[], stats: Record<string, CourseNumbers>, meta: Record<string, CourseMeta>): CardStat[] {
  const score = new Map(cards.map((c) => [c.value, difficulty(stats[c.key], meta[c.key], priorScore(c.rank, c.groupSize)).score]));
  return [...cards].sort((a, b) => score.get(a.value)! - score.get(b.value)! || a.rank - b.rank);
}

export interface StatsData { stats: Record<string, CourseNumbers>; meta: Record<string, CourseMeta> }
/** The numbers for every card, or null when the server has none (offline, the table is not there yet, a local server). Never throws. */
export async function loadStats(fetcher: typeof fetch = fetch): Promise<StatsData | null> {
  try {
    const [s, m] = await Promise.all([fetcher('/api/course-stats'), fetcher('/assets/course-meta.json')]);
    if (!s.ok || !m.ok) return null;
    const stats = (await s.json() as { courses?: Record<string, CourseNumbers> }).courses;
    const meta = await m.json() as Record<string, CourseMeta>;
    return stats && typeof stats === 'object' ? { stats, meta } : null;
  } catch { return null; }
}

/** Puts the numbers under each course card and orders each group by difficulty. Cards without a course path (maps, labs, editor) are left alone. */
export function applyStats(root: HTMLElement, data: StatsData): void {
  for (const grid of root.querySelectorAll<HTMLElement>('.wg-grid')) {
    const cards = [...grid.querySelectorAll<HTMLButtonElement>('.wg-card')].filter((c) => (c.dataset.value ?? '').startsWith('/assets/'));
    const items: CardStat[] = cards.map((c, i) => ({ value: c.dataset.value!, key: statKey(c.dataset.value!), rank: i, groupSize: cards.length }));
    for (const it of items) {
      const card = cards[it.rank], n = data.stats[it.key];
      const d = difficulty(n, data.meta[it.key], priorScore(it.rank, it.groupSize));
      card.querySelector('.wg-stats')?.remove();
      const chips = n || data.meta[it.key] ? statChips(n) : [], dots = d.fromData ? dotsOf(d.score) : 0;
      if (!chips.length && !dots) continue;
      const box = document.createElement('span'); box.className = 'wg-stats';
      if (dots) {
        const e = document.createElement('i'); e.className = 'wg-dots'; e.setAttribute('aria-label', `Difficulty: ${DIFFICULTY_WORDS[dots]}`); e.title = DIFFICULTY_WORDS[dots];
        e.textContent = `${'●'.repeat(dots)}${'○'.repeat(4 - dots)} ${DIFFICULTY_WORDS[dots]}`; box.append(e);
      }
      if (chips.length) {
        const row = document.createElement('span'); row.className = 'wg-chips';
        for (const c of chips) {
          const b = document.createElement('span'); b.className = `wg-chip wg-chip-${c.key}`; b.title = c.tip;
          const v = document.createElement('strong'); v.textContent = `${c.icon} ${c.value}`;
          const l = document.createElement('small'); l.textContent = c.label;
          b.append(v, l); row.append(b);
        }
        box.append(row);
      }
      card.querySelector('.wg-txt')?.append(box);
    }
    if (items.length < 2) continue;
    const sorted = orderByDifficulty(items, data.stats, data.meta).map((it) => cards[it.rank]);
    const after = grid.querySelectorAll('.wg-card:not([data-value^="/assets/"])'); // a group holds course cards only, so this is empty today
    sorted.forEach((c) => (after[0] ? grid.insertBefore(c, after[0]) : grid.append(c)));
  }
}
