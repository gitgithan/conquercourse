// CC-108: the name may hold letters of both cases, digits and symbols, so every place it goes is checked: SQL (bound parameters only), HTML (textContent only) and links (escaped).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, makeChallengeParam, nickFromWire, nickToWire, readChallengeParam, recordPlan } from '../src/sim/replay';
import { logTicks } from '../src/sim/run-checks';
import { nickOk, tidyNick } from '../src/share/nick';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as boardGet } from '../functions/api/leaderboard';
import { assets, localD1 } from './helpers-d1';

const course = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const hash = courseHash(course);
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const send = async (db: unknown, n: number, nick: string) => {
  const body = { session: 'abcdef12-3456', runId: `run-0000000${n}`, courseKey: 'demo/training', hash, keys: await encodeLog(log), claimedTicks: logTicks(log), nick, publish: true };
  return clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': `ip${n}` }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
};
const top = async (db: unknown) => ((await (await boardGet({ request: new Request(`https://x/api/leaderboard?course=demo/training&hash=${hash}`), env: { DB: db } as never })).json()) as { top: { nick: string }[] }).top;

// every one is cut to twelve characters, so the dangerous part is put first
const ATTACKS = [`';DROP TABLE course_clears;--`, `" OR 1=1 --`, `x');DELETE FROM course_clears;--`, `<script>alert(1)</script>`, `<img/src=x>`, `%00%27\\'"`, `a.b.c/d?e=f&g`, `Zed_9-Ace!@#$%^&*`];

describe('the name', () => {
  it('keeps upper and lower case, digits and symbols; drops spaces and anything outside printable ASCII; cuts to twelve', () => {
    expect(tidyNick('Ab9!@#$%^&*()_+-=')).toBe('Ab9!@#$%^&*(');
    expect(tidyNick(' a b\tc\u0000é😀d ')).toBe('abcd');
    expect(tidyNick('abcdefghijklmnop')).toBe('abcdefghijkl');
  });
  it('still refuses blocked words, also written with symbols', () => {
    for (const bad of ['a$$', 'sh!t', 'S3X', 'f.u.c.k', 'N4zi!']) expect(nickOk(bad), bad).toBe(false);
    for (const good of ['Ace!', 'Zed_9', 'K9#', 'x+y=z', 'Hancock']) expect(nickOk(good), good).toBe(true);
  });
});

describe('no SQL injection through the name', () => {
  for (const [i, attack] of ATTACKS.entries()) {
    it(`stores ${JSON.stringify(attack)} as plain text and the table survives`, async () => {
      const { db, sql } = localD1();
      const want = tidyNick(attack);
      expect(nickOk(attack)).toBe(true);
      expect((await send(db, i + 1, attack)).status).toBe(200);
      const row = sql.prepare('SELECT nick FROM course_clears').all() as { nick: string }[];
      expect(row).toEqual([{ nick: want }]); // one row, the name word for word
      expect(await top(db)).toMatchObject([{ nick: want }]);
      expect(sql.prepare('SELECT COUNT(*) AS n FROM course_clears').get()).toEqual({ n: 1 });
      expect(sql.prepare("SELECT name FROM sqlite_master WHERE name = 'course_clears'").all()).toHaveLength(1);
    });
  }
  it('no D1 statement joins a value into its text: every prepare() is a constant, a typed switch or a ? list', () => {
    for (const f of ['course-clear', 'leaderboard', 'leaderboard-run', 'share', 'course-event', 'community']) {
      let src = ''; try { src = readFileSync(`functions/api/${f}.ts`, 'utf8'); } catch { continue; }
      for (const m of src.matchAll(/prepare\(`([^`]*)`/g)) {
        for (const hole of m[1].matchAll(/\$\{([^}]*)\}/g)) expect(hole[1], `${f}: ${m[1].slice(0, 60)}`).toMatch(/^(where|WHO|BASE|newest|cols \? [^}]*|COLS\.join\(', '\)|COLS\.map\(\(\) => '\?'\)\.join\(', '\)|MAX_CLEARS_READ)$/);
      }
    }
  });
});

describe('no HTML from the name', () => {
  it('the board row sets the name with textContent', () => {
    const src = readFileSync('src/ui/leaderboard.ts', 'utf8');
    expect(src).toMatch(/name\.textContent = \(r\.nick/);
  });
  it('the drawing code never sets innerHTML from a name', () => {
    for (const f of ['src/ui/leaderboard.ts', 'src/ui/ghost.ts', 'src/ui/run-view.ts', 'src/share/share-ui.ts']) {
      let src = ''; try { src = readFileSync(f, 'utf8'); } catch { continue; }
      expect(src.match(/\.innerHTML\s*=.*nick/gi), f).toBeNull();
    }
  });
});

describe('the name in a challenge link', () => {
  it('survives dots, slashes, percent and quotes', async () => {
    for (const nick of ['a.b.c', 'A/B?c=d', '50%off!', `it's"ok`, 'Zed_9-']) {
      const wire = nickToWire(nick);
      expect(wire, nick).toMatch(/^[A-Za-z0-9_%-]*$/);
      expect(nickFromWire(wire)).toBe(tidyNick(nick));
      const read = await readChallengeParam(await makeChallengeParam(course, log, nick));
      expect(read.ok && read.challenge.nick, nick).toBe(tidyNick(nick));
    }
  });
  it('refuses a name smuggled in the link that the game would not make', async () => {
    expect(nickFromWire('%2')).toBeNull();
    expect(nickFromWire('%20')).toBeNull(); // a space
    expect(nickFromWire('%00')).toBeNull();
    expect(nickFromWire('a'.repeat(40))).toBeNull();
  });
});
