// Promo v2 click marker (CC-133, scene 2): a big yellow circle over the cursor on every click, plus a small arrow that follows the mouse.
// It lives in the page (so it is in every picture) and runs on the stepped clock: its fade is read from performance.now, never from wall time.
// Scene 1 has its own marker in lib.mjs; this file is separate so the two never collide (one of them can replace the other on a rebase).
export const MARKER_SCRIPT = `(() => {
  const mk = () => {
    if (document.getElementById('promo-marker-layer')) return;
    const L = document.createElement('div'); L.id = 'promo-marker-layer';
    L.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    const arrow = document.createElement('div');
    arrow.innerHTML = '<svg width="30" height="38" viewBox="0 0 30 38"><path d="M3 2 L3 30 L10 23 L15 35 L20 33 L15 21 L25 21 Z" fill="#fff" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/></svg>';
    arrow.style.cssText = 'position:absolute;left:-100px;top:-100px;filter:drop-shadow(0 2px 3px #0008)';
    L.append(arrow); document.documentElement.append(L);
    const rings = [];
    addEventListener('mousemove', (e) => { arrow.style.left = e.clientX - 3 + 'px'; arrow.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      arrow.style.left = e.clientX - 3 + 'px'; arrow.style.top = e.clientY - 2 + 'px';
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;background:rgba(255,214,0,.45);border:7px solid #ffd600;box-sizing:border-box;box-shadow:0 0 18px #ffd600aa';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; L.append(d); rings.push({ d, t0: performance.now() });
    }, true);
    const tick = () => {
      const now = performance.now();
      for (let i = rings.length - 1; i >= 0; i--) {
        const u = (now - rings[i].t0) / 400; // 0.4 s on the film clock
        if (u >= 1) { rings[i].d.remove(); rings.splice(i, 1); continue; }
        rings[i].d.style.opacity = String(1 - u * u); rings[i].d.style.transform = 'scale(' + (1.35 - 0.35 * Math.min(1, u * 4)) + ')';
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (document.documentElement) mk(); else addEventListener('DOMContentLoaded', mk);
  addEventListener('DOMContentLoaded', mk);
})();`;
export const installMarker = (page) => page.addInitScript(MARKER_SCRIPT);
