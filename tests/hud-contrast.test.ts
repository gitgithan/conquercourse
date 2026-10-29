import { describe, expect, it } from 'vitest';
import { HUD, contrastRatio, panelOver, worstContrast } from '../src/ui/hud-style';

describe('readable HUD (CC-156)', () => {
  it('bright text on the panel passes 4.5:1 even over a pure white sky', () => {
    expect(worstContrast(HUD.text)).toBeGreaterThanOrEqual(4.5);
    expect(worstContrast(HUD.soft)).toBeGreaterThanOrEqual(4.5);
  });
  it('passes over a dark tunnel and grass too', () => {
    for (const bg of ['#000000', '#3f7d2c', '#87ceeb']) expect(contrastRatio(HUD.text, panelOver(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
