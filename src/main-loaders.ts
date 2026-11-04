// Which screen a "?mode=" or "?demo=" word opens, in one table each (CC-133, item 5).
// A new screen adds one line here; src/main.ts looks the word up instead of walking a chain of ifs.
// The loaders import their module when called, so a page only downloads the screen it shows.
export interface Screen { backend: string }
export type ScreenLoader = (host: HTMLElement, query: URLSearchParams) => Promise<Screen> | Screen;

export const MODE_LOADERS: Record<string, ScreenLoader> = {
  diagrams: async (h) => (await import('./modes/diagrams-page')).startDiagrams(h),
  parts: async (h) => (await import('./modes/parts')).startParts(h),
  rookie: async (h) => (await import('./render/scene')).createStage(h),
  lineup: async (h) => (await import('./film/lineup')).startLineup(h),
  dojo: async (h) => (await import('./modes/dojo')).startDojo(h),
  editor: async (h) => (await import('./modes/editor')).startEditor(h),
  map: async (h) => (await import('./modes/map')).startMap(h),
  coaster: async (h) => (await import('./modes/coaster')).startCoaster(h),
  'lab-search': async (h) => (await import('./modes/lab-search')).startLabSearch(h),
  'lab-vision': async (h) => (await import('./modes/lab-vision')).startLabVision(h),
  'lab-gentest': async (h) => (await import('./modes/lab-gentest')).startLabGentest(h),
  'lab-signal': async (h) => (await import('./modes/lab-signal')).startLabSignal(h),
  'lab-ik': async (h) => (await import('./modes/lab-ik')).startLabIk(h),
  'lab-rl': async (h) => (await import('./modes/lab-rl')).startLabRl(h),
  'lab-motion': async (h) => (await import('./modes/lab-motion')).startLabMotion(h),
  'lab-optimization': async (h) => (await import('./modes/lab-optimization')).startLabOptimization(h),
  'lab-integration': async (h) => (await import('./modes/lab-integration')).startLabIntegration(h),
  'lab-camera': async (h) => (await import('./modes/lab-camera')).startLabCamera(h),
  'lab-hashing': async (h) => (await import('./modes/lab-hashing')).startLabHashing(h),
  'lab-lift': async (h) => (await import('./modes/lab-lift')).startLabLift(h),
  'lab-detector': async (h) => (await import('./modes/lab-detector')).startLabDetector(h),
  'lab-collision': async (h) => (await import('./modes/lab-collision')).startLabCollision(h),
  'lab-timing': async (h) => (await import('./modes/lab-timing')).startLabTiming(h),
  communities: async (h, q) => (await import('./modes/community-flow')).startCommunityFlow(h, q),
  gallery: async (h, q) => (await import('./modes/community-flow')).startCommunityFlow(h, q),
  park: async (h, q) => (await import('./modes/community-flow')).startCommunityFlow(h, q),
};

/** "?demo=" screens: each starts itself on the page body and returns when done. */
export const DEMO_LOADERS: Record<string, () => Promise<unknown>> = {
  'captured-vault': async () => (await import('./modes/demo-captured-vault')).startCapturedVaultDemo(),
  'welcome-tile': async () => (await import('./modes/demo-welcome-tile')).startWelcomeTile(),
  rookie: async () => (await import('./modes/demo-rookie')).startRookieDemo(),
  group: async () => (await import('./modes/demo-group')).startGroup(),
  groupmoves: async () => (await import('./film/group-photo')).startGroupMoves(),
  poses: async () => (await import('./modes/demo-poses')).startPoses(),
  'hurt-ab': async () => (await import('./modes/demo-poses')).startHurtAB(),
  'roll-ab': async () => (await import('./modes/demo-roll-ab')).startRollAB(),
  lineup: async () => (await import('./modes/demo-lineup')).startLineup(),
  actor: async () => (await import('./modes/demo-actor')).startActorDemo(),
};
