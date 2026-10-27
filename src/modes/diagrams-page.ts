// ?mode=diagrams: all ten Dojo diagrams in a grid, for checking them by eye (CC-31).
import { diagram, DIAGRAM_IDS } from './diagrams';

export function startDiagrams(root: HTMLElement): { backend: string } {
  const cells = DIAGRAM_IDS.flatMap((id) => (['real', 'principle'] as const).map((k) => `<figure data-diagram="${id}-${k}" style="margin:0;border:1px solid #e5e7eb">${diagram(id, k)}</figure>`)).join('');
  root.innerHTML = `<main style="background:#fff;padding:12px;min-height:100vh;overflow:auto"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:1600px;margin:auto">${cells}</div></main>`;
  document.body.style.overflow = 'auto';
  return { backend: 'svg' };
}
