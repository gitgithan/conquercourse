import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { editorWords, slicerWords, SIM_STATE, simSaysPanel } from '../src/ui/sim-says';
import { BANNED_IN_COPY, CREW, SCREENS, SCREEN_ORDER, VOICES, VOICE_SCREENS, saysOn, type VoiceId } from '../src/ui/says';
import { backdropGuard } from '../src/ui/backdrop';
import { courseSource } from './helpers/course-source';
import { editorSource } from './helpers/editor-source';

// The voice badge table (CC-243): who speaks, in what colour, on which model. The words are checked against the model ledger and the never-list.
const ledger = readFileSync('docs/model-ledger.md', 'utf8');
const ids = Object.keys(VOICES) as VoiceId[];
const MODELS = ['Muse Spark Open', 'Muse Image', 'SAM 3D Objects', 'SAM 3.1', 'SAM 3'];

describe('voices', () => {
  it('has a title ending in "says"/"say" for every tech voice, and every voice is on the crew strip once', () => {
    for (const id of ids) {
      const v = VOICES[id];
      expect(v.id).toBe(id);
      if (id !== 'pip' && id !== 'juno') expect(v.title).toMatch(/ says?$/);
    }
    expect([...CREW].sort()).toEqual([...ids].sort());
  });
  it('gives each voice its own colour', () => {
    expect(new Set(ids.map((i) => VOICES[i].accent)).size).toBe(ids.length);
    for (const i of ids) expect(VOICES[i].accent).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('names a model only where the ledger lists it', () => {
    for (const i of ids) {
      const v = VOICES[i], named = MODELS.filter((m) => v.poweredBy.includes(m));
      expect(v.meta).toBe(named.length > 0);
      for (const m of named) expect(ledger).toContain(m);
    }
    // the ones that are not an AI say so
    expect(VOICES.simulator.poweredBy).toMatch(/not an AI/);
    expect(VOICES.ghost.poweredBy).toMatch(/not an AI/);
  });
  it('uses the model the code calls for each job', () => {
    expect(VOICES.partner.poweredBy).toContain('Muse Spark Open');
    expect(VOICES.safety.poweredBy).toContain('Muse Spark Open');
    expect(VOICES.cutter.poweredBy).toContain('SAM 3');
    expect(VOICES.builder.poweredBy).toContain('SAM 3D Objects');
    expect(VOICES.maker.poweredBy).toContain('Muse Image');
  });
  it('keeps the words short, plain and free of formulas, grades and coaching', () => {
    for (const i of ids) {
      const v = VOICES[i];
      for (const t of [v.title, v.poweredBy, v.job]) expect(t, `${i}: ${t}`).not.toMatch(BANNED_IN_COPY);
      expect(v.title.length).toBeLessThanOrEqual(26);
      expect(v.job.length).toBeLessThanOrEqual(90);
      expect(v.poweredBy.length).toBeLessThanOrEqual(70);
    }
  });
  it('points at files that exist, and the doc lists every voice', () => {
    const doc = readFileSync('docs/ui-voices.md', 'utf8');
    for (const i of ids) {
      for (const f of VOICES[i].where.split(',').map((x) => x.trim())) expect(existsSync(f), f).toBe(true);
      expect(doc).toContain(VOICES[i].title);
    }
  });
  it('turns off with ?says=0 and is on otherwise', () => {
    expect(saysOn(new URLSearchParams('says=0'))).toBe(false);
    expect(saysOn(new URLSearchParams(''))).toBe(true);
    expect(saysOn(new URLSearchParams('says=1'))).toBe(true);
  });
});

// The Simulator's live voice in the World Editor and the World Slicer (CC-243, second pass).
describe('Simulator says, live', () => {
  const verdicts = ['', 'Checking this lane…', 'The simulator can clear this lane (2 gaps, 1 steps, 0 curves, 3 faces, 40 m).', 'The simulator cannot find a way to clear this lane: widen a gap or lower a step.',
    'No lane the runner can clear was found: try other pieces or levels.', 'Nothing is in the lane: move the lane or the pieces.', "Stopped: this lane is not checked. Edit it, or press Check again.",
    'Timed out after 3 minutes: this lane is not checked. It may still be clearable. You can play it anyway.', 'The lane check could not finish. Try again after editing stops.'];
  it('maps every editor verdict to a state and plain first-person words', () => {
    const want = ['idle', 'checking', 'clear', 'blocked', 'blocked', 'idle', 'stopped', 'stopped', 'stopped'];
    verdicts.forEach((v, i) => { const w = editorWords(v); expect(w.state, v).toBe(want[i]); expect(w.words, v).not.toMatch(BANNED_IN_COPY); expect(w.words.length).toBeGreaterThan(10); });
    expect(editorWords(verdicts[2]).words).toMatch(/^I can clear this lane \(2 gaps/);
    expect(editorWords('', 'searching').state).toBe('checking');
  });
  it('maps every slicer state to words, and says the length and height', () => {
    for (const k of ['clearable', 'not-clearable', 'checking', 'working', 'none', '']) { const w = slicerWords(k, 90, '12'); expect(w.words, k).not.toMatch(BANNED_IN_COPY); }
    expect(slicerWords('clearable', 90, '12')).toEqual({ state: 'clear', words: 'I can clear this 90 m lane at 12 m. A ghost ran it.' });
    expect(slicerWords('clearable', 90, '12', { proven: true })).toMatchObject({ state: 'clear', words: expect.stringMatching(/ahead of time on the real physics/) }); // CC-90
    expect(slicerWords('not-clearable', 40, '9', { closest: true })).toMatchObject({ state: 'blocked', words: expect.stringMatching(/^No clean line found here: this is the closest at 9 m/) });
    expect(slicerWords('working', 0, '', { auto: 'Trying other heights.' })).toEqual({ state: 'checking', words: 'Trying other heights.' });
    expect(slicerWords('not-clearable').state).toBe('blocked');
    expect(slicerWords('checking').state).toBe('checking');
  });
  it('gives each state its own icon, label and colour, so colour is never the only signal', () => {
    const d = Object.values(SIM_STATE);
    expect(new Set(d.map((x) => x.label)).size).toBe(d.length);
    expect(new Set(d.map((x) => x.icon)).size).toBe(d.length);
    expect(new Set(d.map((x) => x.edge)).size).toBe(d.length);
  });
  it('is off with ?says=0 and says it is not an AI otherwise', () => {
    expect(simSaysPanel('editor', { params: new URLSearchParams('says=0') })).toBeNull();
  });
  it('is wired into the editor and the slicer and never into the Course', () => {
    expect(editorSource()).toContain("simSaysPanel('editor')");
    expect(readFileSync('src/modes/map.ts', 'utf8')).toContain("simSaysPanel('slicer')");
    for (const f of ['src/modes/course.ts', 'src/main.ts']) expect(f === 'src/modes/course.ts' ? courseSource() : f === 'src/modes/editor.ts' ? editorSource() : readFileSync(f, 'utf8'), f).not.toContain('simSaysPanel');
  });
});


// Meet the crew: the side icons and the legend (CC-243, 2026-11-01).
describe('screens where each voice shows up', () => {
  const used = new Set(Object.values(VOICE_SCREENS).flat());
  it('gives every voice at least one screen, and only known screens', () => {
    for (const i of ids) { expect(VOICE_SCREENS[i].length, i).toBeGreaterThan(0); for (const s of VOICE_SCREENS[i]) expect(SCREENS[s], `${i}: ${s}`).toBeDefined(); expect(new Set(VOICE_SCREENS[i]).size).toBe(VOICE_SCREENS[i].length); }
  });
  it('gives every screen a name, a drawing of its own and a legend row, and the legend has no unused screen', () => {
    for (const s of used) { expect(SCREENS[s].name.length).toBeGreaterThan(2); expect(SCREENS[s].icon).toContain('<'); expect(SCREEN_ORDER, s).toContain(s); }
    for (const s of SCREEN_ORDER) expect(used.has(s), `${s} is in the legend but no voice uses it`).toBe(true);
    // shape, not colour: no two screens share a drawing or a name
    expect(new Set(Object.values(SCREENS).map((s) => s.icon)).size).toBe(Object.keys(SCREENS).length);
    expect(new Set(Object.values(SCREENS).map((s) => s.name)).size).toBe(Object.keys(SCREENS).length);
  });
  it('is true to the code: the files that mount a badge are in the screens it claims', () => {
    const has = (f: string, t: string) => expect(f === 'src/modes/course.ts' ? courseSource() : f === 'src/modes/editor.ts' ? editorSource() : readFileSync(f, 'utf8'), `${f} ${t}`).toContain(t);
    has('src/modes/editor.ts', "simSaysPanel('editor')"); has('src/modes/map.ts', "simSaysPanel('slicer')");
    has('src/modes/graph-studio.ts', "addBadge(verdictEl.parentElement!, 'simulator'"); has('src/modes/coaster.ts', "'simulator'");
    has('src/modes/editor.ts', "sayBadge('partner')");
    has('src/modes/community-flow.ts', "'safety'"); has('src/modes/community-flow.ts', "'cutter'"); has('src/modes/community-flow.ts', "'builder'");
    has('src/characters/panel.ts', "'maker'"); has('src/ui/ghost.ts', "'ghost'"); has('src/ui/place-photos.ts', "nameTag('street')");
    has('src/modes/course.ts', "mountLivePhotos"); has('src/modes/map.ts', "mountPlacePhotos"); has('src/modes/course.ts', "createGhost");
  });
  it('lists the same screens in docs/ui-voices.md as the map does', () => {
    const doc = readFileSync('docs/ui-voices.md', 'utf8');
    for (const i of ids) {
      const row = doc.split('\n').find((l) => l.startsWith('|') && l.includes(VOICES[i].title) && l.includes('`src/') && !l.includes('(live)') && !l.includes('(small)')) ?? doc.split('\n').find((l) => l.startsWith('|') && l.includes(VOICES[i].title))!;
      for (const s of VOICE_SCREENS[i]) expect(row, `${i} row names ${SCREENS[s].name}`).toContain(SCREENS[s].name);
    }
    for (const s of SCREEN_ORDER) expect(doc).toContain(SCREENS[s].name);
  });
});

// Click outside a dialog closes it, but only when the press and the release are both on the backdrop (CC-243).
describe('backdrop close', () => {
  const back = {}, inner = {};
  it('closes on a press and release on the backdrop, not on the panel', () => {
    let n = 0; const g = backdropGuard(back, () => n++);
    g.down({ target: inner }); g.click({ target: inner }); expect(n).toBe(0);
    g.down({ target: back }); g.click({ target: back }); expect(n).toBe(1);
  });
  it('does not close when a drag starts inside the panel and ends outside', () => {
    let n = 0; const g = backdropGuard(back, () => n++);
    g.down({ target: inner }); g.click({ target: back }); expect(n).toBe(0);
  });
  it('does not close when a drag starts outside and ends inside, and needs a fresh press each time', () => {
    let n = 0; const g = backdropGuard(back, () => n++);
    g.down({ target: back }); g.click({ target: inner }); expect(n).toBe(0);
    g.click({ target: back }); expect(n).toBe(0);
  });
  it('is wired into the character picker next to Esc, with the one close function', () => {
    const src = readFileSync('src/characters/panel.ts', 'utf8');
    expect(src).toContain('closeOnBackdrop(root, close)');
    expect(src).toContain("e.key === 'Escape') close()");
  });
});
