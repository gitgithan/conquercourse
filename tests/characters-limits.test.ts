import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BONES, glbProblems, MAX_FACES, MAX_GLB_BYTES, MAX_TEXTURE_PX, MAX_THUMB_BYTES, MAX_VERTS, THUMB_OK } from '../src/characters/limits';
import { CHARACTER_STEPS } from '../src/characters/steps';
import { cardName, cleanPrompt, promptKey, promptProblem } from '../src/characters/prompt';
import { glb } from './helpers-char';

describe('the size caps agree between Python and TypeScript', () => {
  const py = readFileSync('pipelines/charmaker/limits.py', 'utf8');
  const num = (name: string) => Number((new RegExp(`^${name}\\s*=\\s*([0-9_]+)`, 'm').exec(py) ?? [])[1]?.replace(/_/g, ''));
  it.each([['MAX_FACES', MAX_FACES], ['MAX_VERTS', MAX_VERTS], ['MAX_TEXTURE_PX', MAX_TEXTURE_PX], ['MAX_GLB_BYTES', MAX_GLB_BYTES], ['MAX_THUMB_BYTES', MAX_THUMB_BYTES], ['BONES', BONES]])('%s', (n, v) => expect(num(n as string)).toBe(v));
  it('the stage names are the same, in the same order', () => {
    const m = /^STAGES\s*=\s*\[(.*)\]/m.exec(readFileSync('pipelines/charmaker/contracts.py', 'utf8'))!;
    const py_ = m[1].split(',').map((s) => s.trim().replace(/"/g, ''));
    expect(CHARACTER_STEPS.map((s) => s.id).slice(0, 5)).toEqual(py_);
    expect(CHARACTER_STEPS[5].id).toBe('done');
  });
});

describe('glbProblems', () => {
  it('accepts a small 34-bone character', () => expect(glbProblems(glb())).toEqual([]));
  it('refuses 30 bones, animations, too many faces, a big texture and junk', () => {
    expect(glbProblems(glb({ bones: 30 })).join()).toMatch(/30 bones/);
    expect(glbProblems(glb({ animations: true })).join()).toMatch(/animations/);
    expect(glbProblems(glb({ faces: MAX_FACES + 3 })).join()).toMatch(/faces/);
    expect(glbProblems(glb({ tex: 512 })).join()).toMatch(/texture is 512/);
    expect(glbProblems(new Uint8Array(40)).join()).toMatch(/readable/);
    expect(glbProblems(glb({ pad: MAX_GLB_BYTES })).join()).toMatch(/bytes/);
  });
  it('thumbnails must be small webp', () => {
    const t = new Uint8Array(40); t.set([82, 73, 70, 70], 0); t.set([87, 69, 66, 80], 8);
    expect(THUMB_OK(t)).toBe(true);
    expect(THUMB_OK(new Uint8Array(40))).toBe(false);
  });
});

describe('prompts', () => {
  it('cleans and keys', () => {
    expect(cleanPrompt('  a <b>big</b>   frog\n')).toBe('a b big /b frog');
    expect(promptKey('A Big, Frog!')).toBe('a big frog');
    expect(cardName('a tiny dragon in a hat')).toBe('Tiny dragon in a hat');
  });
  it('refuses too short, too long, weapons, children and real people', () => {
    expect(promptProblem('ab')).not.toBe('');
    expect(promptProblem('a friendly robot frog')).toBe('');
    expect(promptProblem('a knight with a gun')).not.toBe('');
    expect(promptProblem('a little child')).not.toBe('');
  });
});
