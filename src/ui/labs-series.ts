// CC-133: the Labs as a series. One list of {mode, name, pipeline, stage}: the nav bar, the world picker and the tests all read it.
// A Lab's number is its place in this list and never changes (links in docs and films use it); a new Lab is one line at the END.
export type Pipeline = 'photo' | 'video' | 'idea' | 'methods' | 'map';
export interface LabEntry { mode: string; name: string; pipeline: Pipeline; stage: string }

/** The sections, in the order they are taught. */
export const PIPELINES: readonly { id: Pipeline; title: string; stages: readonly string[] }[] = [
  { id: 'photo', title: 'Photo to course object', stages: ['Photo', 'Cut-out', 'Lift to 3D', 'Bake', 'Collision', 'Place and prove'] },
  { id: 'video', title: 'Video to motion', stages: ['Video', 'Pose', 'Smooth', 'Gate', 'Clip'] },
  { id: 'idea', title: 'Idea to course', stages: ['Brief', 'Propose', 'Check', 'Fix it', 'Show'] },
  { id: 'methods', title: 'Methods behind the pipelines', stages: [] },
  { id: 'map', title: 'Map to lane', stages: ['Pin', 'Elements', 'Cut', 'Lane', 'Rules', 'Simulator'] },
];

// Numbers 1 to 12 are fixed; 13 (motion), 14 (lift) and 15 (collision) followed in the order they landed; 16 (slicer) is the Map to lane pipeline. A new Lab is one line at the end.
export const LAB_LIST: readonly LabEntry[] = [
  { mode: 'lab-search', name: 'Search', pipeline: 'methods', stage: 'Search' },
  { mode: 'lab-optimization', name: 'Optimization', pipeline: 'methods', stage: 'Optimize' },
  { mode: 'lab-ik', name: 'Posing a character', pipeline: 'video', stage: 'Clip' },
  { mode: 'lab-vision', name: 'Computer vision', pipeline: 'photo', stage: 'Cut-out' },
  { mode: 'lab-camera', name: 'Camera and perspective', pipeline: 'photo', stage: 'Lift to 3D' },
  { mode: 'lab-integration', name: 'Numerical integration', pipeline: 'methods', stage: 'Replay' },
  { mode: 'lab-timing', name: 'Statistics of timing', pipeline: 'methods', stage: 'Keys' },
  { mode: 'lab-signal', name: 'Signal processing', pipeline: 'video', stage: 'Smooth' },
  { mode: 'lab-gentest', name: 'Generate and test', pipeline: 'photo', stage: 'Place and prove' },
  { mode: 'lab-detector', name: 'Evaluating a detector', pipeline: 'photo', stage: 'Cut-out' },
  { mode: 'lab-hashing', name: 'Verification and hashing', pipeline: 'methods', stage: 'Hash' },
  { mode: 'lab-rl', name: 'Reinforcement learning', pipeline: 'methods', stage: 'Learn' },
  { mode: 'lab-motion', name: 'Video to motion', pipeline: 'video', stage: 'Gate' },
  { mode: 'lab-lift', name: 'Cut-out, lift and bake', pipeline: 'photo', stage: 'Bake' },
  { mode: 'lab-collision', name: 'Collision from a 3D lift', pipeline: 'photo', stage: 'Collision' },
  { mode: 'lab-partner', name: 'Design partner loop', pipeline: 'idea', stage: 'Fix it' },
  { mode: 'lab-systemdesign', name: 'System design: build the whole game', pipeline: 'methods', stage: 'Design' },
  { mode: 'lab-slicer', name: 'World Slicer: map to lane', pipeline: 'map', stage: 'Simulator' },
];

/** The Labs of one section, in number order, each with its number. */
export const labsOfPipeline = (id: Pipeline): { n: number; lab: LabEntry }[] =>
  LAB_LIST.flatMap((lab, i) => (lab.pipeline === id ? [{ n: i + 1, lab }] : []));

// CC-133: the two tiers. Every Lab sits in exactly one sub-header. Foundations are the skills the game stands on; Pipelines are how it was built end to end.
export type Tier = 'foundations' | 'pipelines' | 'finale';
export interface LabGroup { id: string; tier: Tier; title: string; modes: readonly string[] }
export const TIERS: readonly { id: Tier; title: string }[] = [
  { id: 'foundations', title: 'Foundations' },
  { id: 'pipelines', title: 'Pipelines' },
  { id: 'finale', title: 'Finale' },
];
/** In the order they are shown (Foundations first; inside a pipeline, the order the data flows). Lab numbers and URLs never change. */
export const LAB_GROUPS: readonly LabGroup[] = [
  { id: 'search-learn', tier: 'foundations', title: 'Search and learn', modes: ['lab-search', 'lab-optimization', 'lab-rl', 'lab-gentest'] },
  { id: 'see-world', tier: 'foundations', title: 'See the world', modes: ['lab-vision', 'lab-camera', 'lab-detector'] },
  { id: 'move-measure', tier: 'foundations', title: 'Move and measure', modes: ['lab-ik', 'lab-integration', 'lab-timing', 'lab-signal'] },
  { id: 'trust', tier: 'foundations', title: 'Trust the result', modes: ['lab-hashing'] },
  { id: 'photo', tier: 'pipelines', title: 'Photo to course object', modes: ['lab-lift', 'lab-collision'] },
  { id: 'video', tier: 'pipelines', title: 'Video to motion', modes: ['lab-motion'] },
  { id: 'idea', tier: 'pipelines', title: 'Idea to course', modes: ['lab-partner'] },
  { id: 'map', tier: 'pipelines', title: 'Map to lane', modes: ['lab-slicer'] },
  { id: 'finale', tier: 'finale', title: 'System design', modes: ['lab-systemdesign'] }, // the last Lab: it sums up the three pipelines
];
export const groupOf = (mode: string): LabGroup | undefined => LAB_GROUPS.find((g) => g.modes.includes(mode));
export const labNumberOf = (mode: string): number => LAB_LIST.findIndex((l) => l.mode === mode) + 1;
export const labName = (mode: string): string => LAB_LIST.find((l) => l.mode === mode)?.name ?? mode;

/** One pipeline stage: the Foundation Labs it relies on ("uses") and the pipeline Lab that teaches it (null = no Lab yet, an honest gap). */
export interface PipelineStage { stage: string; uses: readonly string[]; lab: string | null }
export const PIPELINE_MAP: Record<'photo' | 'video' | 'idea' | 'map', readonly PipelineStage[]> = {
  photo: [
    { stage: 'Photo', uses: ['lab-camera'], lab: null },
    { stage: 'Cut-out', uses: ['lab-vision', 'lab-detector'], lab: 'lab-lift' },
    { stage: 'Lift to 3D', uses: ['lab-camera'], lab: 'lab-lift' },
    { stage: 'Bake', uses: [], lab: 'lab-lift' },
    { stage: 'Collision', uses: ['lab-gentest'], lab: 'lab-collision' },
    { stage: 'Place and prove', uses: ['lab-gentest', 'lab-timing', 'lab-search'], lab: null },
  ],
  video: [
    { stage: 'Video', uses: [], lab: 'lab-motion' },
    { stage: 'Pose', uses: ['lab-camera'], lab: 'lab-motion' },
    { stage: 'Smooth', uses: ['lab-signal'], lab: 'lab-motion' },
    { stage: 'Gate', uses: ['lab-signal'], lab: 'lab-motion' },
    { stage: 'Clip', uses: ['lab-ik'], lab: 'lab-motion' },
  ],
  idea: [
    { stage: 'Brief', uses: [], lab: 'lab-partner' },
    { stage: 'Propose', uses: ['lab-gentest'], lab: 'lab-partner' },
    { stage: 'Check', uses: ['lab-search'], lab: 'lab-partner' },
    { stage: 'Fix it', uses: ['lab-search'], lab: 'lab-partner' },
    { stage: 'Show', uses: ['lab-gentest'], lab: 'lab-partner' },
  ],
  map: [
    { stage: 'Pin', uses: [], lab: 'lab-slicer' },
    { stage: 'Elements', uses: ['lab-detector'], lab: 'lab-slicer' },
    { stage: 'Cut', uses: [], lab: 'lab-slicer' },
    { stage: 'Lane', uses: ['lab-camera'], lab: 'lab-slicer' },
    { stage: 'Rules', uses: ['lab-timing'], lab: 'lab-slicer' },
    { stage: 'Simulator', uses: ['lab-search'], lab: 'lab-slicer' },
  ],
};
const PIPELINE_TITLE = (id: string): string => LAB_GROUPS.find((g) => g.id === id)?.title ?? id;

/** Foundation Labs a pipeline Lab relies on, over the stages it teaches. */
export const usesOf = (mode: string): string[] => [...new Set(Object.values(PIPELINE_MAP).flatMap((st) => st.filter((x) => x.lab === mode).flatMap((x) => x.uses)))];

/** Where a Foundation Lab is used: one entry per pipeline stage that lists it. */
export const usedIn = (mode: string): { pipeline: string; title: string; stage: string; lab: string | null }[] =>
  (Object.entries(PIPELINE_MAP) as [string, readonly PipelineStage[]][]).flatMap(([id, st]) => st.filter((x) => x.uses.includes(mode)).map((x) => ({ pipeline: id, title: PIPELINE_TITLE(id), stage: x.stage, lab: x.lab })));

/** For a pipeline Lab: the Lab before it and after it in its pipeline (null at the ends), and the stages of the pipeline that have no Lab yet. */
export function flowOf(mode: string): { group: LabGroup; from: string | null; next: string | null; gaps: PipelineStage[] } | null {
  const g = groupOf(mode);
  if (!g || g.tier !== 'pipelines') return null;
  const i = g.modes.indexOf(mode);
  return { group: g, from: g.modes[i - 1] ?? null, next: g.modes[i + 1] ?? null, gaps: PIPELINE_MAP[g.id as 'photo'].filter((x) => x.lab === null) };
}

/** The Finale Lab sums up the whole series: the Labs it draws on (by mode), and the Lab before it. */
export const FINALE_USES: readonly string[] = ['lab-search', 'lab-camera', 'lab-signal', 'lab-hashing', 'lab-motion', 'lab-lift', 'lab-collision'];
