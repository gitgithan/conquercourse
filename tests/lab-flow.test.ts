import { describe, expect, it } from 'vitest';
import { SEE_ALSO, seeAlsoOf, LAB_GROUPS, LAB_LIST, PIPELINE_MAP, flowOf, usedIn, usesOf } from '../src/ui/labs-series';
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

  it('see-also links: precision/recall Labs point both ways, every link resolves, both ways exist, no hard-coded numbers', () => {
    const modes = new Set(LAB_LIST.map((l) => l.mode));
    for (const x of SEE_ALSO) {
      expect(modes.has(x.from) && modes.has(x.to), `${x.from}->${x.to}`).toBe(true);
      expect(SEE_ALSO.some((y) => y.from === x.to && y.to === x.from), `no way back ${x.to}->${x.from}`).toBe(true);
    }
    expect(seeAlsoOf('lab-vision').map((x) => x.to)).toContain('lab-detector');
    expect(seeAlsoOf('lab-detector').map((x) => x.to)).toContain('lab-vision');
    const v = flowPieces('lab-vision')!.top; expect(v).toContain('id="lab-flow-see"'); expect(v).toContain('data-lab="lab-detector"'); expect(v).toContain('same trade-off with real detector scores');
    expect(flowPieces('lab-detector')!.top).toContain('See where the threshold comes from');
    expect(flowPieces('lab-lift')!.top).toContain('data-lab="lab-camera"'); // a pipeline Lab gets the row too
    expect(flowPieces('lab-ik')!.top).not.toContain('lab-flow-see'); // none listed, none shown
  });
});
