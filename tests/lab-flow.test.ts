import { describe, expect, it } from 'vitest';
import { LAB_GROUPS, LAB_LIST, PIPELINE_MAP, flowOf, usedIn, usesOf } from '../src/ui/labs-series';
import { flowPieces } from '../src/ui/lab-flow';

// CC-133: pipeline Labs say where they come from, which Foundation Labs they use and what is next; Foundation Labs say where they are used.
describe('lab flow (two tiers)', () => {
  it('chains the photo pipeline 14 -> 15 and leaves video as a single Lab', () => {
    expect(flowOf('lab-lift')).toMatchObject({ from: null, next: 'lab-collision' });
    expect(flowOf('lab-collision')).toMatchObject({ from: 'lab-lift', next: null });
    expect(flowOf('lab-motion')).toMatchObject({ from: null, next: null });
    expect(flowOf('lab-ik')).toBeNull(); // a Foundation Lab has no from/next
  });
  it('uses: video relies on Labs 8 and 3; photo on 4, 5, 10 and 9', () => {
    const n = (m: string) => LAB_LIST.findIndex((l) => l.mode === m) + 1;
    expect(usesOf('lab-motion').map(n).sort((a, b) => a - b)).toEqual(expect.arrayContaining([3, 8]));
    const photo = [...usesOf('lab-lift'), ...usesOf('lab-collision')].map(n);
    for (const k of [4, 5, 10, 9]) expect(photo).toContain(k);
  });
  it('every "uses" is a Foundation Lab, and used-in is the exact mirror', () => {
    const foundation = new Set(LAB_GROUPS.filter((g) => g.tier === 'foundations').flatMap((g) => g.modes));
    for (const st of Object.values(PIPELINE_MAP).flat()) for (const u of st.uses) expect(foundation.has(u), u).toBe(true);
    expect(usedIn('lab-signal').map((u) => u.stage)).toEqual(['Smooth', 'Gate']);
    expect(usedIn('lab-ik').some((u) => u.pipeline === 'video')).toBe(true);
  });
  it('gives pipeline Labs a from chip, uses chips and a next link; Foundation Labs a used-in row', () => {
    const lift = flowPieces('lab-lift')!;
    expect(lift.top).toContain('id="lab-flow-from"'); expect(lift.top).toContain('uses:'); expect(lift.end).toContain('href="?mode=lab-collision&labs=1&welcome=0"');
    expect(flowPieces('lab-collision')!.top).toContain('from: Lab 14');
    expect(flowPieces('lab-motion')!.end).toContain('Back to the game');
    const sig = flowPieces('lab-signal')!; expect(sig.top).toContain('used in:'); expect(sig.top).toContain('Video to motion: Smooth'); expect(sig.end).toBe('');
    expect(flowPieces('lab-nope')).toBeNull();
  });
});
