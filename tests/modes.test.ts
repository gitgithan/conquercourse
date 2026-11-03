import { describe, expect, it } from 'vitest';
import { MODE_INFO } from '../src/course/modes';

describe('mode table', () => {
  it('every mode has a name and a machine says what to do next', () => {
    for (const [mode, info] of Object.entries(MODE_INFO)) {
      expect(info.name.length, mode).toBeGreaterThan(0);
      if (info.machine) expect(info.next, mode).toBeTruthy();
    }
  });
  it('keeps the names the debug panel has always shown', () => {
    expect(MODE_INFO.drone.name).toBe('On the drone');
    expect(MODE_INFO.launch.next).toBe('Let go now');
    expect(Object.keys(MODE_INFO).length).toBe(14);
  });
});
