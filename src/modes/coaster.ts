import { coasterCourse, parseTrack } from '../slice/coaster';
import { fixCart } from '../slice/fixcart';
import { crestSpeedLimit, makeRails } from '../sim/cart';
import { playPlan, searchIdealRun, type Plan } from '../sim/ideal';
import { GRAVITY } from '../sim/units';

// ?mode=coaster: build a coaster in the side view. Drag the dots to shape the track, double-click empty space to add a dot, double-click a dot to take it out.
// The cart is run on the same physics the Course uses, so the verdict under the picture is the simulator's, not a guess.
// A track is not a lane cut through pieces, so it has its own small editor; "Play it" opens the Course with the track in the address.
const NO_BRAKE: Plan = { jumpXs: [], releaseAfter: 0, bouncePress: 0, cartBrake: [] };
const START: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]];

export const trackToQuery = (pts: [number, number][], push: number): string =>
  `coaster=${pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')}&push=${+push.toFixed(2)}`;

export function startCoaster(host: HTMLElement): { backend: 'webgl2' } {
  const q = new URLSearchParams(location.search);
  let pts: [number, number][] = START.map((p) => [...p] as [number, number]);
  let push = 1.5;
  const fromUrl = q.get('coaster');
  const parsed = parseTrack(fromUrl);
  if (parsed) { pts = parsed; push = Number(q.get('push') ?? 1.5) || 1.5; }
  const style = document.createElement('style');
  style.textContent = `
    .co{font:15px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:12px;display:grid;gap:8px;align-content:start}
    .co h1{margin:0;font-size:19px}.co canvas{background:#fff;border:1px solid #cfd6d0;border-radius:10px;width:100%;max-width:1100px;touch-action:none}
    .co .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.co button,.co a.btn{font:600 14px system-ui;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;text-decoration:none}
    .co .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c}.co .verdict{font-weight:700;padding:6px 10px;border-left:5px solid #888;background:#fff;border-radius:6px;max-width:1100px}
    .co .muted{color:#58635d;font-size:13px}.co label{display:flex;gap:8px;align-items:center}
  `;
  const root = document.createElement('div'); root.className = 'co';
  root.innerHTML = `<h1>Coaster builder</h1>
    <div class="muted">Drag the dots to shape the track. Double-click empty space to add a dot; double-click a dot to take it out. The cart starts at rest on the left dot after a push.</div>
    <canvas id="cocanvas" width="1100" height="440"></canvas>
    <div class="verdict" id="coverdict"></div>
    <div class="row"><label>Push at the start <input id="copush" type="range" min="0" max="4" step="0.1" value="${push}"> <span id="copushv"></span> m/s</label>
      <button id="cofix">Fix it</button><a class="btn go" id="coplay">Play it</a><a class="btn" id="codojo" href="?mode=dojo&ex=coaster">Dojo: hills and speed</a><a class="btn" href="?mode=editor">World editor</a></div>
    <div class="muted" id="costeps"></div>`;
  host.append(style, root);
  const cv = root.querySelector('#cocanvas') as HTMLCanvasElement, c = cv.getContext('2d')!;
  const verdict = root.querySelector('#coverdict') as HTMLElement, steps = root.querySelector('#costeps') as HTMLElement;
  const pushEl = root.querySelector('#copush') as HTMLInputElement, pushV = root.querySelector('#copushv') as HTMLElement;
  const playEl = root.querySelector('#coplay') as HTMLAnchorElement;
  const W = cv.width, H = cv.height, PADL = 40, PADB = 30;
  let drag = -1;

  const view = () => {
    const maxX = Math.max(60, ...pts.map((p) => p[0])) + 4, maxY = Math.max(12, ...pts.map((p) => p[1])) + 2;
    return { maxX, maxY, sx: (x: number) => PADL + (x / maxX) * (W - PADL - 12), sy: (y: number) => H - PADB - (y / maxY) * (H - PADB - 14), ix: (px: number) => ((px - PADL) / (W - PADL - 12)) * maxX, iy: (py: number) => ((H - PADB - py) / (H - PADB - 14)) * maxY };
  };

  function ride() {
    const course = coasterCourse('My coaster', pts, push);
    const r = playPlan(course, NO_BRAKE, 120 * 90);
    const off = r.events.find((e) => e.type === 'cart-off'), stall = r.events.find((e) => e.type === 'cart-stall');
    // the path of the unbraked ride
    return { course, r, off, stall, outcome: r.world.outcome };
  }

  function draw() {
    const v = view();
    c.clearRect(0, 0, W, H);
    c.strokeStyle = '#e5e7eb'; c.lineWidth = 1; c.fillStyle = '#58635d'; c.font = '12px system-ui';
    for (let x = 0; x <= v.maxX; x += 10) { c.beginPath(); c.moveTo(v.sx(x), 8); c.lineTo(v.sx(x), H - PADB); c.stroke(); c.fillText(`${x}`, v.sx(x) - 6, H - 10); }
    for (let y = 0; y <= v.maxY; y += 2) { c.beginPath(); c.moveTo(PADL, v.sy(y)); c.lineTo(W - 12, v.sy(y)); c.stroke(); c.fillText(`${y}`, 12, v.sy(y) + 4); }
    c.fillText('metres along', W - 90, H - 10); c.fillText('metres up', 60, 12);
    const rails = makeRails(pts);
    const { r, off, stall } = ride();
    // where the cart can go: the highest the first hill and the push allow (a dashed line)
    const top = pts[0][1] + (push * push) / (2 * GRAVITY);
    c.setLineDash([8, 6]); c.strokeStyle = '#16a34a'; c.beginPath(); c.moveTo(v.sx(rails.x0), v.sy(top)); c.lineTo(v.sx(rails.x1), v.sy(top)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#16a34a'; c.fillText(`the most the cart can climb: ${top.toFixed(1)} m`, v.sx(rails.x0) + 8, v.sy(top) - 6);
    // the rails, coloured by how sharp the top is: red where a cart at the speed it would have there would leave
    c.lineWidth = 5; c.lineCap = 'round';
    for (let x = rails.x0; x < rails.x1; x += 0.4) {
      const sp = Math.sqrt(Math.max(0, push * push + 2 * GRAVITY * (pts[0][1] - rails.y(x)))), lim = crestSpeedLimit(rails, x);
      c.strokeStyle = sp > lim ? '#dc2626' : '#17201d';
      c.beginPath(); c.moveTo(v.sx(x), v.sy(rails.y(x))); c.lineTo(v.sx(x + 0.4), v.sy(rails.y(Math.min(x + 0.4, rails.x1)))); c.stroke();
    }
    // the unbraked ride's last position
    const px = r.world.runner.x, py = r.world.runner.y;
    c.fillStyle = off ? '#dc2626' : stall ? '#f59e0b' : '#16a34a';
    c.beginPath(); c.arc(v.sx(off ? (off.detail!.x as number) : stall ? (stall.detail!.x as number) : Math.min(px, rails.x1)), v.sy(off ? rails.y(off.detail!.x as number) : stall ? (stall.detail!.height as number) : rails.y(Math.min(px, rails.x1))), 8, 0, Math.PI * 2); c.fill();
    void py;
    pts.forEach((p, i) => { c.fillStyle = i === drag ? '#0f6b5c' : '#fff'; c.strokeStyle = '#0f6b5c'; c.lineWidth = 3; c.beginPath(); c.arc(v.sx(p[0]), v.sy(p[1]), 7, 0, Math.PI * 2); c.fill(); c.stroke(); });
    // the verdict
    const ok = r.world.outcome === 'cleared';
    verdict.style.borderLeftColor = ok ? '#16a34a' : off ? '#dc2626' : '#f59e0b';
    if (ok) verdict.textContent = 'The cart rolls all the way home with no brake.';
    else if (off) {
      const x = off.detail!.x as number;
      const braked = searchIdealRun(coasterCourse('t', pts, push));
      verdict.textContent = `The cart leaves the rails at ${x.toFixed(0)} m: it is doing ${(off.detail!.v as number).toFixed(1)} m/s over a top that lets go above ${crestSpeedLimit(rails, x).toFixed(1)} m/s.${braked.cleared ? ' It can be ridden if you brake (hold ↓) before it.' : ''}`;
    } else if (stall) verdict.textContent = `The cart runs out of speed on the hill at ${(stall.detail!.x as number).toFixed(0)} m (${(stall.detail!.height as number).toFixed(1)} m high): it can only climb as high as it started, plus a little from the push.`;
    else verdict.textContent = 'The cart has not finished: check the track.';
    playEl.href = `?${trackToQuery(pts, push)}`;
    pushV.textContent = push.toFixed(1);
    document.documentElement.dataset.coaster = JSON.stringify({ outcome: r.world.outcome, points: pts.length, off: !!off, stall: !!stall });
  }

  const hit = (e: PointerEvent): number => {
    const b = cv.getBoundingClientRect(), v = view();
    const mx = ((e.clientX - b.left) / b.width) * W, my = ((e.clientY - b.top) / b.height) * H;
    return pts.findIndex((p) => Math.hypot(v.sx(p[0]) - mx, v.sy(p[1]) - my) < 14);
  };
  const toWorld = (e: PointerEvent): [number, number] => {
    const b = cv.getBoundingClientRect(), v = view();
    return [v.ix(((e.clientX - b.left) / b.width) * W), v.iy(((e.clientY - b.top) / b.height) * H)];
  };
  cv.addEventListener('pointerdown', (e) => { const i = hit(e); if (i >= 0) { drag = i; cv.setPointerCapture(e.pointerId); draw(); } });
  cv.addEventListener('pointermove', (e) => {
    if (drag < 0) { cv.style.cursor = hit(e) >= 0 ? 'grab' : 'default'; return; }
    const [x, y] = toWorld(e);
    const lo = drag > 0 ? pts[drag - 1][0] + 1 : -50, hi = drag < pts.length - 1 ? pts[drag + 1][0] - 1 : 400;
    pts[drag] = [Math.min(hi, Math.max(lo, Math.round(x * 4) / 4)), Math.min(30, Math.max(0, Math.round(y * 4) / 4))];
    draw();
  });
  cv.addEventListener('pointerup', () => { drag = -1; draw(); });
  cv.addEventListener('dblclick', (e) => {
    const b = cv.getBoundingClientRect();
    const i = hit(e as unknown as PointerEvent);
    if (i >= 0) { if (pts.length > 3) pts.splice(i, 1); }
    else {
      const [x, y] = [view().ix(((e.clientX - b.left) / b.width) * W), view().iy(((e.clientY - b.top) / b.height) * H)];
      pts.push([Math.round(x * 4) / 4, Math.min(30, Math.max(0, Math.round(y * 4) / 4))]); pts.sort((a, b2) => a[0] - b2[0]);
      for (let k = 1; k < pts.length; k++) if (pts[k][0] <= pts[k - 1][0]) pts[k][0] = pts[k - 1][0] + 0.5; // never two dots at one place
    }
    steps.textContent = ''; draw();
  });
  pushEl.oninput = () => { push = Number(pushEl.value); draw(); };
  (root.querySelector('#cofix') as HTMLButtonElement).onclick = () => {
    const f = fixCart(pts, push);
    steps.textContent = f.ok ? (f.steps.length ? f.steps.join(' ') : 'Nothing to fix: this track already rolls home.') : 'No small change makes this track roll home: try a higher first hill.';
    if (f.ok) pts = f.pts;
    draw();
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) location.href = '?'; });
  pushEl.value = String(push);
  draw();
  return { backend: 'webgl2' };
}
