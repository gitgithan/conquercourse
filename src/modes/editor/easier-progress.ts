import type { CourseData } from '../../course/course';
import type { EasierProgress } from '../../slice/easier';
import { el } from './dom';

// Tiny side profiles share one scale. These are candidate layouts, not animations of imaginary trials.
export function easierProgress(parent: HTMLElement, base: CourseData, cancel: () => void) {
  parent.replaceChildren();
  const line = el('div', parent, { text: 'Reusing the current simulator proof…', id: 'easierstatus', role: 'status' });
  el('button', parent, { text: 'Cancel search', id: 'canceleasier' }).onclick = cancel;
  const cards = el('div', parent, { id: 'easiercards' });
  cards.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px';
  const rows = new Map<number, { box: HTMLElement; label: HTMLElement }>();
  const xs = base.terrain.platforms.flatMap((p) => [p.x0, p.x1]);
  const lo = Math.min(base.startX, ...xs) - 2, hi = Math.max(base.finishX, ...xs) + 2;
  function profile(canvas: HTMLCanvasElement, course: CourseData) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const x = (n: number) => 8 + (n - lo) / (hi - lo) * 224;
    ctx.fillStyle = '#111d29'; ctx.fillRect(0, 0, 240, 95);
    const draw = (c: CourseData, color: string, outline: boolean) => {
      ctx.fillStyle = ctx.strokeStyle = color;
      for (const p of c.terrain.platforms) { const y = 80 - p.top * 11, w = Math.max(1, x(p.x1) - x(p.x0)); if (outline) ctx.strokeRect(x(p.x0), y, w, 6); else ctx.fillRect(x(p.x0), y, w, 6); }
      for (const h of c.holds ?? []) { ctx.beginPath(); ctx.arc(x(h.x), 80 - h.y * 11, 3, 0, Math.PI * 2); if (outline) ctx.stroke(); else ctx.fill(); }
    };
    draw(base, '#8e9ca9', true); draw(course, '#57dbc3', false);
    ctx.fillStyle = '#f0c15b'; ctx.fillRect(x(base.startX) - 2, 73, 4, 7);
  }
  return {
    update(p: EasierProgress) {
      line.textContent = `Trying change ${p.index} of ${p.total}. Grey: now. Teal: candidate.`;
      let row = rows.get(p.index);
      if (!row) {
        // Keep the current wave and the preceding results, rather than growing an endless feed.
        if (rows.size >= 4) { const first = rows.keys().next().value!; rows.get(first)!.box.remove(); rows.delete(first); }
        const box = el('div', cards); box.style.cssText = 'border:1px solid #526373;border-radius:6px;padding:6px;font-size:12px;min-width:0';
        el('div', box, { text: `${p.index}. ${p.words}` });
        const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 95; canvas.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:240/95'; box.append(canvas); profile(canvas, p.course);
        row = { box, label: el('div', box) }; rows.set(p.index, row);
      }
      row.label.textContent = p.state === 'testing' ? 'Simulator running…' : p.cleared ? `Verified · ${Math.round(p.before)} → ${Math.round(p.after ?? 0)} ms` : 'No clear run found';
      row.box.dataset.state = p.state;
    },
  };
}
