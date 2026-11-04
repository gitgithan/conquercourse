// A deterministic resource-lifetime teaching model, not a browser/GPU timing predictor.
export type ResourceKind = 'renderer' | 'assets' | 'scene' | 'controls' | 'worker';
export interface Resource { id: number; kind: ResourceKind; units: number }
export interface ReuseChoices { renderer: boolean; assets: boolean; cleanup: boolean }
export interface ReuseState { course: number; switches: number; nextId: number; active: Resource[]; leaked: Resource[] }
export interface ReuseStage { label: string; work: number; why: string }
export interface ReuseTurn { before: ReuseState; after: ReuseState; kept: Resource[]; made: Resource[]; retired: Resource[]; stages: ReuseStage[]; work: number }
export const KINDS: readonly ResourceKind[] = ['renderer', 'assets', 'scene', 'controls', 'worker'];
export const RESOURCE_UNITS: Record<ResourceKind, number> = { renderer: 8, assets: 12, scene: 3, controls: 1, worker: 2 };
export const RESOURCE_NAMES: Record<ResourceKind, string> = { renderer: 'Renderer', assets: 'Models + motion', scene: 'Course scene', controls: 'Key controls', worker: 'Search worker' };
export const OUR_REUSE: ReuseChoices = { renderer: true, assets: true, cleanup: true };
export const activeUnits = (s: ReuseState): number => s.active.reduce((n, r) => n + r.units, 0);
export const leakedUnits = (s: ReuseState): number => s.leaked.reduce((n, r) => n + r.units, 0);
export function freshReuse(): ReuseState {
  return { course: 0, switches: 0, nextId: 6, active: KINDS.map((kind, i) => ({ id: i + 1, kind, units: RESOURCE_UNITS[kind] })), leaked: [] };
}
/** Only renderer/assets can survive a switch; course scene, controls and worker always belong to one course. */
export function switchReuse(before: ReuseState, choices: ReuseChoices): ReuseTurn {
  const kept = before.active.filter((r) => (r.kind === 'renderer' && choices.renderer) || (r.kind === 'assets' && choices.assets));
  const replaced = before.active.filter((r) => !kept.includes(r));
  let nextId = before.nextId;
  const made = replaced.map((r) => ({ ...r, id: nextId++ }));
  const after: ReuseState = { course: 1 - before.course, switches: before.switches + 1, nextId,
    active: KINDS.map((kind) => [...kept, ...made].find((r) => r.kind === kind)!),
    leaked: choices.cleanup ? [...before.leaked] : [...before.leaked, ...replaced] };
  const stages: ReuseStage[] = [
    { label: 'Fetch course', work: 1, why: 'The new layout still has to arrive.' },
    { label: choices.cleanup ? 'Close old course' : 'Skip cleanup', work: choices.cleanup ? replaced.length : 0, why: choices.cleanup ? 'Remove the outgoing scene, controls and worker; release anything being replaced.' : 'Replaced resources stay alive; later cleanup does not repair these earlier leftovers.' },
    { label: choices.renderer ? 'Keep renderer' : 'Build renderer', work: choices.renderer ? 0 : 8, why: choices.renderer ? 'The same graphics device and canvas survive.' : 'Create another graphics device and canvas.' },
    { label: choices.assets ? 'Keep assets' : 'Load assets', work: choices.assets ? 0 : 12, why: choices.assets ? 'Reuse models and motion data; the new runner still gets its own pose.' : 'Load and parse models and motion again.' },
    { label: 'Build scene', work: 3, why: 'Each course needs its own scene, controls and search ownership.' },
    { label: 'First frame', work: 2, why: 'Reusing resources does not remove drawing work.' },
  ];
  return { before, after, kept, made, retired: choices.cleanup ? replaced : [], stages, work: stages.reduce((n, s) => n + s.work, 0) };
}
