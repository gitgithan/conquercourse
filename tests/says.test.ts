import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANNED_IN_COPY, CREW, VOICES, saysOn, type VoiceId } from '../src/ui/says';

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
    expect(VOICES.agent.poweredBy).toContain('Muse Spark Open');
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
