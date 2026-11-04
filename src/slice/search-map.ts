import type { CourseData } from '../course/course';

// A fixed side profile locates the reported search obstacle. It is not an animation of trial runs.
export function createSearchMap() {
  const canvas = document.createElement('canvas'); canvas.id = 'lane-search-map'; canvas.width = 320; canvas.height = 90;
  canvas.style.cssText = 'display:block;width:100%;height:auto;max-height:90px'; canvas.setAttribute('role', 'img');
  function draw(course: CourseData, at: number | null) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const platforms = course.terrain.platforms;
    const holds = [...(course.holds ?? []), ...(course.bars ?? []).flatMap((b) => Array.from({ length: b.n }, (_, i) => ({ x: b.x + i * b.gap, y: b.y })))];
    const xs = [course.startX, course.finishX, ...platforms.flatMap((p) => [p.x0, p.x1]), ...holds.map((h) => h.x)];
    const lo = Math.min(...xs) - 1, hi = Math.max(...xs) + 1;
    const bottom = Math.min(0, ...platforms.map((p) => p.top)), top = Math.max(3.5, ...platforms.map((p) => p.top), ...holds.map((h) => h.y)) + 0.5;
    const x = (v: number) => 10 + (v - lo) / Math.max(1, hi - lo) * 300;
    const y = (v: number) => 76 - (v - bottom) / (top - bottom) * 62;
    ctx.fillStyle = '#142a31'; ctx.fillRect(0, 0, 320, 90);
    ctx.fillStyle = '#67d3bd';
    for (const p of platforms) ctx.fillRect(x(p.x0), y(p.top), Math.max(1, x(p.x1) - x(p.x0)), 5);
    for (const h of holds) { ctx.beginPath(); ctx.arc(x(h.x), y(h.y), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d5e7e4'; ctx.font = '10px sans-serif'; ctx.fillText('Start', 8, 87); ctx.fillText('Finish', 282, 87);
    if (at !== null) {
      ctx.fillStyle = '#ffd35b33'; ctx.fillRect(x(at) - 7, 4, 14, 74);
      ctx.strokeStyle = '#ffd35b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(at), 5); ctx.lineTo(x(at), 76); ctx.stroke();
      ctx.fillStyle = '#ffd35b'; ctx.beginPath(); ctx.moveTo(x(at) - 5, 4); ctx.lineTo(x(at) + 5, 4); ctx.lineTo(x(at), 11); ctx.fill();
    }
    canvas.setAttribute('aria-label', at === null ? 'Side view of the lane being checked.' : `Side view of the lane. Simulator is checking the obstacle at ${at} metres, marked in gold.`);
  }
  return { canvas, draw };
}
