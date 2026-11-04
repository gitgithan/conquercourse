// CC-133: the Labs as a series. One list of {mode, name, pipeline, stage}: the nav bar, the world picker and the tests all read it.
// A Lab's number is its place in this list and never changes (links in docs and films use it); a new Lab is one line at the END.
export type Pipeline = 'photo' | 'video' | 'run' | 'methods';
export interface LabEntry { mode: string; name: string; pipeline: Pipeline; stage: string }

/** The sections, in the order they are taught. */
export const PIPELINES: readonly { id: Pipeline; title: string; stages: readonly string[] }[] = [
  { id: 'photo', title: 'Photo to course object', stages: ['Photo', 'Cut-out', 'Lift to 3D', 'Bake', 'Collision', 'Place and prove'] },
  { id: 'video', title: 'Video to motion', stages: ['Video', 'Pose', 'Smooth', 'Gate', 'Clip'] },
  { id: 'run', title: 'Run to shared link', stages: ['Run', 'Keys', 'Replay', 'Hash', 'Share'] },
  { id: 'methods', title: 'Methods behind all three', stages: [] },
];

// Numbers 1 to 12 are fixed; the three new Labs (collision, lift, motion) are added below as 13 to 15 when their branches land.
export const LAB_LIST: readonly LabEntry[] = [
  { mode: 'lab-search', name: 'Search', pipeline: 'methods', stage: 'Search' },
  { mode: 'lab-optimization', name: 'Optimization', pipeline: 'methods', stage: 'Optimize' },
  { mode: 'lab-ik', name: 'Posing a character', pipeline: 'video', stage: 'Clip' },
  { mode: 'lab-vision', name: 'Computer vision', pipeline: 'photo', stage: 'Cut-out' },
  { mode: 'lab-camera', name: 'Camera and perspective', pipeline: 'photo', stage: 'Lift to 3D' },
  { mode: 'lab-integration', name: 'Numerical integration', pipeline: 'run', stage: 'Replay' },
  { mode: 'lab-timing', name: 'Statistics of timing', pipeline: 'run', stage: 'Keys' },
  { mode: 'lab-signal', name: 'Signal processing', pipeline: 'video', stage: 'Smooth' },
  { mode: 'lab-gentest', name: 'Generate and test', pipeline: 'photo', stage: 'Place and prove' },
  { mode: 'lab-detector', name: 'Evaluating a detector', pipeline: 'photo', stage: 'Cut-out' },
  { mode: 'lab-hashing', name: 'Verification and hashing', pipeline: 'run', stage: 'Hash' },
  { mode: 'lab-rl', name: 'Reinforcement learning', pipeline: 'methods', stage: 'Learn' },
  { mode: 'lab-motion', name: 'Video to motion', pipeline: 'video', stage: 'Gate' },
];

/** The Labs of one section, in number order, each with its number. */
export const labsOfPipeline = (id: Pipeline): { n: number; lab: LabEntry }[] =>
  LAB_LIST.flatMap((lab, i) => (lab.pipeline === id ? [{ n: i + 1, lab }] : []));
