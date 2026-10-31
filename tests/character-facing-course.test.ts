// What the player sees: every character in the REAL Course, holding Right and then Left.
// The table comes from `data/eval/cc-chars-facing/scripts/probe-course.mjs` (a browser run of the real Course scene; the script is the way to refresh it).
// The first facing fix was only checked in a side-view demo that assumed the run goes along +x; this test reads what the Course scene really did.
// The skin is bound to the same bones as the actor group, so the turn by the heading (+1 or -1) carries skin and toes together; the skin-against-bones check is made standing, because mid-stride the shoe cues are not readable.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

interface Side { moved: number; movedDir: number; heading: number; boneToeDx: number; skinLean: number; skinConfidence: number; headingFollowsPress: boolean }
interface Row { name: string; errors: string[]; idleStart: Side; right: Side; left: Side }
const rows: Row[] = JSON.parse(readFileSync('data/eval/cc-chars-facing/course-probe.json', 'utf8'));
const cast = JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')).items as { name: string }[];

describe('every character in the real Course scene, pressing right then left', () => {
  it('covers the Rookie and all eight made characters', () => {
    expect(rows.map((r) => r.name).sort()).toEqual(['Rookie', ...cast.map((c) => c.name)].sort());
  });
  for (const r of rows) {
    describe(r.name, () => {
      it('ran without errors and really moved the way the key says', () => {
        expect(r.errors).toEqual([]);
        expect(r.right.movedDir).toBe(1);
        expect(r.left.movedDir).toBe(-1);
        expect(r.right.moved).toBeGreaterThan(1.5);
        expect(r.left.moved).toBeLessThan(-1.5);
      });
      it('the actor is turned to the way it moves (the Course renderer heading)', () => {
        expect(r.right.heading).toBe(1);
        expect(r.left.heading).toBe(-1);
        expect(r.right.headingFollowsPress && r.left.headingFollowsPress).toBe(true);
      });
      it('standing before any key, the toe bones point along the heading (+1) and the skin shoes agree when the cues are sure', () => {
        expect(r.idleStart.heading).toBe(1);
        expect(r.idleStart.boneToeDx).toBeGreaterThanOrEqual(0);
        if (r.idleStart.skinConfidence >= 0.25) expect(Math.sign(r.idleStart.skinLean)).toBe(1); // the pose is flat only here; mid-stride the shoe cues are not readable
      });
    });
  }
});
