const shared = new WeakSet<{ dispose(): void }>();
export const retainGeometry = (g: { dispose(): void }): void => { shared.add(g); };
export const disposeGeometry = (g: { dispose(): void }): void => { if (!shared.has(g)) g.dispose(); };

const textures = new WeakSet<{ dispose(): void }>();
export const retainTexture = (t: { dispose(): void }): void => { textures.add(t); };
export const disposeTexture = (t: { dispose(): void }): void => { if (!textures.has(t)) t.dispose(); };
