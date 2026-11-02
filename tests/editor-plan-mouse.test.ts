import { describe, expect, it, vi } from 'vitest';
import { attachPlanMouse } from '../src/modes/editor/plan-mouse';
import { createEditorState } from '../src/modes/editor/state';

// Pins the plan mouse moved out of editor.ts (CC-133): the wheel zooms toward the cursor and keeps the point under it.
describe('editor plan mouse', () => {
  it('wheel zooms toward the cursor and keeps the point under it', () => {
    const ed = createEditorState();
    const handlers: Record<string, (e: unknown) => void> = {};
    const plan = { width: 800, height: 600, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), addEventListener: (n: string, f: (e: unknown) => void) => { handlers[n] = f; }, setPointerCapture: () => {} } as unknown as HTMLCanvasElement;
    const wx = (px: number) => (px - plan.width / 2) / ed.view.ppm + ed.view.cx;
    const wz = (py: number) => (py - plan.height / 2) / ed.view.ppm + ed.view.cz;
    const draw = vi.fn();
    attachPlanMouse({ ed, plan, multiOn: false, wx, wz, chosen: () => [], chooseMany: () => {}, moveWith: () => {}, draw, drawProfile: () => {}, drawPanel: () => {}, changed: () => {} });
    const before = { x: wx(600), z: wz(100) };
    handlers.wheel({ clientX: 600, clientY: 100, deltaY: -100, preventDefault: () => {} });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(wx(600)).toBeCloseTo(before.x, 9);
    expect(wz(100)).toBeCloseTo(before.z, 9);
    expect(ed.view.ppm).toBeGreaterThan(0.5);
  });
});
