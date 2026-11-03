import { describe, expect, it } from 'vitest';
import { createPlanDraw } from '../src/modes/editor/plan-draw';
import { createEditorState } from '../src/modes/editor/state';

// Pins the plan helpers moved out of editor.ts (CC-133): screen and world coordinates are inverses, and the view centre is the canvas centre.
describe('editor plan drawing helpers', () => {
  it('maps the view centre to the canvas centre and back', () => {
    const ed = createEditorState();
    const plan = { width: 800, height: 600 } as unknown as HTMLCanvasElement;
    const { sx, sz, wx, wz } = createPlanDraw({ ed, plan, view3d: {} as never, chosen: () => [], placeBar: () => {}, rubber: () => null });
    expect(sx(ed.view.cx)).toBeCloseTo(400, 9);
    expect(sz(ed.view.cz)).toBeCloseTo(300, 9);
    expect(wx(sx(3.5))).toBeCloseTo(3.5, 9);
    expect(wz(sz(-2.25))).toBeCloseTo(-2.25, 9);
  });
});
