import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PadState, TOUCH_BUTTONS, touchOn } from '../src/share/touch';

const ask = (coarse: boolean) => () => ({ coarse, hover: !coarse });
const q = (s: string) => new URLSearchParams(s);

describe('touch controls (CC-139)', () => {
  it('every key action has a button, and each button presses the key the keyboard presses', () => {
    const codes = Object.fromEntries(TOUCH_BUTTONS.map((b) => [b.id, b.code]));
    expect(codes).toMatchObject({ left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', squat: 'ArrowDown', hold: 'KeyE', vault: 'KeyV', roll: 'KeyX', aim: 'ArrowUp', fire: 'KeyK' });
  });
  it('the buttons have their own ids and the keys exist in the game', () => {
    expect(new Set(TOUCH_BUTTONS.map((b) => b.id)).size).toBe(TOUCH_BUTTONS.length);
    const course = readFileSync('src/modes/course.ts', 'utf8');
    for (const b of TOUCH_BUTTONS) expect(course.includes(`'${b.code}'`), b.code).toBe(true);
  });
  it('two fingers at once press two keys (run and jump)', () => {
    const p = new PadState();
    expect(p.down(1, 'right')).toEqual([{ type: 'keydown', code: 'ArrowRight' }]);
    expect(p.down(2, 'jump')).toEqual([{ type: 'keydown', code: 'Space' }]);
    expect(p.up(2)).toEqual([{ type: 'keyup', code: 'Space' }]);
    expect(p.up(1)).toEqual([{ type: 'keyup', code: 'ArrowRight' }]);
  });
  it('two fingers on one button press the key once and let go when the last one leaves', () => {
    const p = new PadState();
    expect(p.down(1, 'jump')).toHaveLength(1);
    expect(p.down(2, 'jump')).toHaveLength(0);
    expect(p.up(1)).toHaveLength(0);
    expect(p.up(2)).toEqual([{ type: 'keyup', code: 'Space' }]);
  });
  it('a lost finger lets go of everything', () => {
    const p = new PadState();
    p.down(1, 'left'); p.down(2, 'squat');
    expect(p.releaseAll().map((e) => e.code).sort()).toEqual(['ArrowDown', 'ArrowLeft']);
    expect(p.releaseAll()).toEqual([]);
  });
  it('shows on a touch device, hides on a computer, and ?touch decides first', () => {
    expect(touchOn(q(''), ask(true))).toBe(true);
    expect(touchOn(q(''), ask(false))).toBe(false);
    expect(touchOn(q('touch=1'), ask(false))).toBe(true);
    expect(touchOn(q('touch=0'), ask(true))).toBe(false);
  });
});
