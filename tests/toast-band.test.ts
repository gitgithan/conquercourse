// CC-133: the short messages (hint, toasts, dimmed older hints) live in one band in the sky, never over the runner.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { toastBandBox, TOAST_TOP, TOAST_BAND_BOTTOM } from '../src/ui/toast-band';

const W = 1280, H = 720;
const box = toastBandBox(W, H);

// The side camera (src/modes/course/camera.ts): target 5 m ahead of the runner and 2.5 m above his feet, 25 m back and 1.5 m up (scaled by the zoom), 40 degree view.
// `lag`: how far the camera's height still trails the runner's (it eases with 0.15 s, so a quick rise leaves it behind).
function runnerBox(feetY: number, opts: { zoom?: number; lag?: number; pitch?: number } = {}) {
  const zoom = opts.zoom ?? 1, lag = opts.lag ?? 0, pitch = opts.pitch;
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 400);
  const tx = 5, ty = feetY + 2.5 - lag; // the runner is at x = 0
  const off = new THREE.Vector3(0, 1.5, 25), len = off.length() * zoom;
  const p = pitch ?? Math.asin(off.y / off.length());
  cam.position.set(tx, ty + len * Math.sin(p), len * Math.cos(p)); cam.lookAt(tx, ty, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const pts = [-0.4, 0.4].flatMap((dx) => [0, 1.8].map((dy) => new THREE.Vector3(dx, feetY + dy, 0).project(cam)));
  const px = pts.map((q) => ({ x: ((q.x + 1) / 2) * W, y: ((1 - q.y) / 2) * H }));
  return { left: Math.min(...px.map((q) => q.x)), right: Math.max(...px.map((q) => q.x)), top: Math.min(...px.map((q) => q.y)), bottom: Math.max(...px.map((q) => q.y)) };
}
const meets = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe('toast band', () => {
  it('sits in the top band of the window at 1280 x 720', () => {
    expect(box.top).toBeLessThanOrEqual(0.34 * H); // the top third at most: the strip and the ghost chip take the first 225 px
    expect(box.bottom).toBeLessThanOrEqual(0.44 * H + 1e-9);
    expect(box.top).toBeGreaterThanOrEqual(226); // under the strip and the ghost chip (it ends at 225)
    expect(box.left).toBeGreaterThan(330); // right of the controls card (it ends at about x = 328)
    expect(box.right).toBeLessThan(W - 250); // left of the buttons
  });
  it('is centred and never wider than the window', () => {
    for (const vw of [1280, 1024]) { const b = toastBandBox(vw, 720); expect((b.left + b.right) / 2).toBeCloseTo(vw / 2); expect(b.right - b.left).toBeLessThanOrEqual(vw * 0.92 + 1e-9); }
  });
  it('is one shared place: the hint, the toast stack and the hint history all join the band, none sets its own position', () => {
    for (const f of ['src/modes/course/hud.ts', 'src/ui/toast-stack.ts', 'src/ui/hint-history.ts', 'src/modes/course/say.ts', 'src/ui/bars-keys.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/(bottom:46%|top:44%|bottom:\$\{|position:fixed;left:50%;bottom)/);
    }
    expect(readFileSync('src/ui/toast-stack.ts', 'utf8')).toContain('toastBand()');
    expect(readFileSync('src/ui/hint-history.ts', 'utf8')).toContain('toastBand()');
    expect(readFileSync('src/modes/course/chrome.ts', 'utf8')).toContain('toastBand().append(d.hud.hint)');
    expect(TOAST_TOP).toMatch(/px$/);
    expect(TOAST_BAND_BOTTOM).toBeLessThanOrEqual(0.44);
  });
  const states: [string, number, { zoom?: number; lag?: number; pitch?: number }][] = [
    ['on the ground, normal view', 0, {}],
    ['high on the path (bars at 4.3 m), normal view', 4.3, {}],
    ['high on the path, camera still catching up (1.5 m behind)', 4.3, { lag: 1.5 }],
    ['camera low to the ground (smallest pitch)', 0, { pitch: 0.03 }],
    ['camera low and the runner high', 4.3, { pitch: 0.03, lag: 1.5 }],
    ['wheel zoomed in a little', 0, { zoom: 0.6 }],
    ['wheel zoomed out', 4.3, { zoom: 1.7 }],
    ['a quick rise in a jump, camera 1 m behind, zoomed in a little', 2, { lag: 1, zoom: 0.6 }],
  ];
  for (const [name, y, o] of states) {
    it(`never meets the runner: ${name}`, () => {
      const r = runnerBox(y, o);
      expect(meets(box, r), JSON.stringify({ box, r })).toBe(false);
    });
  }
});
