import { describe, expect, it } from 'vitest';
import { PHONE_WORDS, isPhoneWithoutKeyboard, phoneMode } from '../src/share/phone';

const phone = { coarse: true, hover: false }, laptop = { coarse: false, hover: true }, hybrid = { coarse: true, hover: true };

describe('the phone check (CC-138)', () => {
  it('a finger without hover is a phone', () => expect(isPhoneWithoutKeyboard(phone)).toBe(true));
  it('a laptop and a touch laptop are not', () => {
    expect(isPhoneWithoutKeyboard(laptop)).toBe(false);
    expect(isPhoneWithoutKeyboard(hybrid)).toBe(false);
  });
  it('?phone=1 forces it and ?phone=0 turns it off', () => {
    expect(phoneMode(new URLSearchParams('phone=1'), () => laptop)).toBe(true);
    expect(phoneMode(new URLSearchParams('phone=0'), () => phone)).toBe(false);
    expect(phoneMode(new URLSearchParams(''), () => phone)).toBe(true);
  });
  it('says in plain words to play on a computer', () => expect(PHONE_WORDS('9.36 s')).toMatch(/Play it on a computer/));
});
