import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AREA, PROMO_SECONDS, promoFraction, promoPeakSpeed, promoSpeed, promoStride } from '../src/making-of/promo-walk';

// CC-133: the promo walk of The Grand Entrance takes exactly 5 s on the film clock, starts slow, never jerks, and never shows a flat placeholder.
const page = readFileSync('public/making-of/timeline.html', 'utf8');
const walkers = readFileSync('src/making-of/walkers.ts', 'utf8');
const TUNNEL = 40680; // entrance to stage, in page units (checked below against the event list)

describe('promo walk timing', () => {
  it('starts at the entrance and lands on the stage at exactly 5.0 s', () => {
    expect(PROMO_SECONDS).toBe(5);
    expect(promoFraction(0)).toBe(0);
    expect(promoFraction(5)).toBeCloseTo(1, 12);
    expect(promoFraction(9)).toBe(promoFraction(5)); // past the end it stays on the stage
  });
  it('on a 30 fps stepped clock, picture 150 is the stage and picture 1 has hardly moved', () => {
    expect(promoFraction(150 / 30)).toBeCloseTo(1, 9);
    expect(promoFraction(1 / 30) * TUNNEL).toBeLessThan(5);
  });
  it('never goes backwards, starts slow, speeds up smoothly, and has no jump between pictures', () => {
    let prev = 0, prevStep = 0, firstPeak = -1;
    for (let i = 1; i <= 150; i++) {
      const f = promoFraction(i / 30), step = f - prev;
      expect(step).toBeGreaterThanOrEqual(0);
      if (i <= 120) expect(step - prevStep).toBeGreaterThanOrEqual(-1e-9); // speeding up all the way to the ease-out
      expect(Math.abs(step - prevStep) * TUNNEL).toBeLessThan(60); // acceleration per picture stays small (no jerk)
      if (firstPeak < 0 && step * 30 * TUNNEL > 0.9 * promoPeakSpeed(TUNNEL)) firstPeak = i;
      prev = f; prevStep = step;
    }
    expect(promoSpeed(0)).toBe(0);
    expect(promoSpeed(5)).toBe(0);
    expect(promoSpeed(4)).toBe(1);
  });
  it('at most 1 s with no pixels moving: the first second already covers visible ground', () => {
    expect(promoFraction(0.5) * TUNNEL).toBeGreaterThan(1);
    expect(promoFraction(1) * TUNNEL).toBeGreaterThan(20);
  });
  it('the peak speed is the tunnel length over the area under the speed curve', () => {
    expect(promoPeakSpeed(TUNNEL)).toBeCloseTo(TUNNEL / AREA, 6);
    expect(AREA).toBeGreaterThan(2.4);
    expect(AREA).toBeLessThan(2.6);
  });
  it('the legs swing slowly at first and faster later, and never stop going forward', () => {
    expect(promoStride(0)).toBe(0);
    expect(promoStride(1) - promoStride(0)).toBeLessThan(promoStride(4) - promoStride(3));
    for (let i = 1; i <= 150; i++) expect(promoStride(i / 30)).toBeGreaterThan(promoStride((i - 1) / 30));
  });
  it('the page tunnel length is 40680 for the committed events (so the numbers above are real)', () => {
    const ev = JSON.parse(readFileSync('public/making-of/timeline-events.json', 'utf8')) as { when: string }[];
    const days = new Set(ev.map((e) => e.when.split(' to ').pop()!.slice(0, 5)));
    const slots = ev.length + days.size;
    expect((slots + 1) * 380 + 400).toBe(TUNNEL);
  });
});

describe('promo mode never shows the flat placeholder', () => {
  it('the flat figures and the buttons are hidden by a class set before the first picture', () => {
    expect(page).toMatch(/html\.promo :is\(#rookie,#junoFig,#crew[^)]*\)\{display:none!important\}/);
    expect(page).toContain("if(PROMO)document.documentElement.classList.add('promo')");
  });
  it('the promo clock starts only when Pip, Juno and all the cast have been tried', () => {
    expect(page).toContain('w&&w.ready&&w.pip&&w.juno');
    expect(page).toContain('if(PROMO)promoStart();else{requestAnimationFrame(frame)');
    expect(walkers).toContain('api.ready = true');
    // ready is set after the loop over the eight cast characters
    expect(walkers.indexOf('api.ready = true')).toBeGreaterThan(walkers.indexOf('for (let i = 0; i < cast.length'));
  });
  it('the promo walk is driven by the clock alone (performance.now), not by keys, wheel or the animation-frame stamp', () => {
    const run = /function promoRun\(\)\{[\s\S]*?\n\}\n/.exec(page)![0];
    expect(run).toContain('performance.now()');
    expect(run).not.toMatch(/keydown|wheel|dir\b|auto\b/);
    expect(page).toContain('juno:promoT!==null||pos>junoAt'); // Juno is there from the first picture
  });
  it('the normal page keeps its late loading and flat fallbacks', () => {
    expect(page).toContain('setTimeout(lateWalkers,500)');
    expect(page).toContain("SPACING=380");
  });
});
