import { coasterCourse, parseTrack } from '../slice/coaster';
import { fixCart } from '../slice/fixcart';
import { crestSpeedLimit, makeRails } from '../sim/cart';
import { playPlan, searchIdealRun, type Plan } from '../sim/ideal';
import { GRAVITY } from '../sim/units';
import { pageQuery } from '../flags';

// ?mode=coaster: build a coaster in the side view. Drag the dots to shape the track, double-click empty space to add a dot, double-click a dot to take it out.
// The cart is run on the same physics the Course uses, so the verdict under the picture is the simulator's, not a guess.
// A track is not a lane cut through pieces, so it has its own small editor; "Play it" opens the Course with the track in the address.
const NO_BRAKE: Plan = { jumpXs: [], releaseAfter: 0, bouncePress: 0, cartBrake: [] };
const START: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]];

export const trackToQuery = (segments: [number, number][][] | [number, number][], push: number): string => {
  const list = segments.length && typeof (segments[0] as unknown[])[0] === 'number' ? [segments as [number, number][]] : segments as [number, number][][];
  return `coaster=${list.map((s) => s.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')).join('|')}&push=${+push.toFixed(2)}`;
};

export function startCoaster(host: HTMLElement): { backend: 'webgl2' } {
  const q = pageQuery();
  let segments: [number, number][][] = [START.map((p) => [...p] as [number, number])];
  let push = 1.5;
  const fromUrl = q.get('coaster');
  const parsed = parseTrack(fromUrl);
  if (parsed) { segments = parsed; push = Number(q.get('push') ?? 1.5) || 1.5; }
  const style = document.createElement('style');
  style.textContent = `
    .co{font:15px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;position:fixed;inset:0;overflow:auto;padding:12px;display:grid;gap:8px;align-content:start}
    .co h1{margin:0;font-size:19px}.co canvas{background:#fff;border:1px solid #cfd6d0;border-radius:10px;width:100%;max-width:1100px;touch-action:none}
    .co .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.co button,.co a.btn{font:600 14px system-ui;border:1px solid #17201d;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;text-decoration:none}
    .co .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c}.co .verdict{font-weight:700;padding:6px 10px;border-left:5px solid #888;background:#fff;border-radius:6px;max-width:1100px}
    .co .howto{border:2px solid #0f6b5c;border-radius:10px;background:#fff;padding:8px 14px;max-width:1100px}.co .howto h2{margin:0 0 4px;font-size:17px;color:#0f6b5c}.co .howto ul{margin:0;padding-left:20px;font-size:15px}.co .howto li{margin:3px 0}.co .howto kbd{font:700 13px system-ui;background:#17201d;color:#fff;border-radius:5px;padding:1px 7px}
    .co .muted{color:#58635d;font-size:13px}.co label{display:flex;gap:8px;align-items:center}
  `;
  const root = document.createElement('div'); root.className = 'co';
  root.innerHTML = `<h1>Coaster builder</h1>
    <div class="howto"><h2>How to shape the coaster</h2><ul>
      <li><kbd>Drag</kbd> a dot to move it.</li>
      <li><kbd>Double-click</kbd> the track to add a dot; double-click a dot to take it out.</li>
      <li>Add a separate section to make a jump: in the game, press <kbd>Space</kbd> to leave the cart any time.</li></ul></div>
    <canvas id="cocanvas" width="1100" height="440"></canvas>
    <div class="verdict" id="coverdict"></div>
    <div class="row"><label>Push at the start <input id="copush" type="range" min="0" max="4" step="0.1" value="${push}"> <span id="copushv"></span> m/s</label>
      <button id="coaddsegment">Add track section</button><button id="coremove">Remove last section</button><button id="cofix">Fix it</button><a class="btn go" id="coplay">Play it</a><a class="btn" id="codojo" href="?mode=dojo&ex=coaster">Dojo: hills and speed</a><a class="btn" href="?mode=editor">World Editor</a></div>
    <div class="muted" id="costeps"></div>`;
  host.append(style, root);
  const cv = root.querySelector('#cocanvas') as HTMLCanvasElement, c = cv.getContext('2d')!;
  const verdict = root.querySelector('#coverdict') as HTMLElement, steps = root.querySelector('#costeps') as HTMLElement;
  const pushEl = root.querySelector('#copush') as HTMLInputElement, pushV = root.querySelector('#copushv') as HTMLElement;
  const playEl = root.querySelector('#coplay') as HTMLAnchorElement;
  const allPoints = () => segments.flat();
  const locate = (flatIndex: number) => {
    let n = flatIndex;
    for (let s = 0; s < segments.length; s++) { if (n < segments[s].length) return { s, p: n }; n -= segments[s].length; }
    return { s: 0, p: 0 };
  };
  const W = cv.width, H = cv.height, PADL = 40, PADB = 30;
  let drag = -1;

  const view = () => {
    const pts = allPoints();
    const maxX = Math.max(60, ...pts.map((p) => p[0])) + 4, maxY = Math.max(12, ...pts.map((p) => p[1])) + 2;
    return { maxX, maxY, sx: (x: number) => PADL + (x / maxX) * (W - PADL - 12), sy: (y: number) => H - PADB - (y / maxY) * (H - PADB - 14), ix: (px: number) => ((px - PADL) / (W - PADL - 12)) * maxX, iy: (py: number) => ((H - PADB - py) / (H - PADB - 14)) * maxY };
  };

  function ride() {
    const course = coasterCourse('My coaster', segments, push);
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
    const yStep = v.maxY <= 20 ? 2 : Math.ceil(v.maxY / 10 / 5) * 5;
    for (let y = 0; y <= v.maxY; y += yStep) { c.beginPath(); c.moveTo(PADL, v.sy(y)); c.lineTo(W - 12, v.sy(y)); c.stroke(); c.fillText(`${y}`, 12, v.sy(y) + 4); }
    c.fillText('metres along', W - 90, H - 10); c.fillText('metres up', 60, 12);
    const railsList = segments.map(makeRails), rails = railsList[0], first = segments[0];
    const { r, off, stall } = ride();
    // where the cart can go: the highest the first hill and the push allow (a dashed line)
    const top = first[0][1] + (push * push) / (2 * GRAVITY);
    c.setLineDash([8, 6]); c.strokeStyle = '#16a34a'; c.beginPath(); c.moveTo(v.sx(rails.x0), v.sy(top)); c.lineTo(v.sx(rails.x1), v.sy(top)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#16a34a'; c.fillText(`the most the cart can climb: ${top.toFixed(1)} m`, v.sx(rails.x0) + 8, v.sy(top) - 6);
    // the rails, coloured by how sharp the top is: red where a cart at the speed it would have there would leave
    c.lineWidth = 5; c.lineCap = 'round';
    railsList.forEach((section, si) => {
      c.lineWidth = 5; c.lineCap = 'round';
      for (let x = section.x0; x < section.x1; x += 0.4) {
        const sp = Math.sqrt(Math.max(0, push * push + 2 * GRAVITY * (first[0][1] - section.y(x)))), lim = crestSpeedLimit(section, x);
        c.strokeStyle = sp > lim ? '#dc2626' : '#17201d';
        c.beginPath(); c.moveTo(v.sx(x), v.sy(section.y(x))); c.lineTo(v.sx(Math.min(x + 0.4, section.x1)), v.sy(section.y(Math.min(x + 0.4, section.x1)))); c.stroke();
      }
      if (si > 0) { c.fillStyle = '#8a2d29'; c.font = '700 12px system-ui'; c.fillText('FLY', v.sx(section.x0 - 2), v.sy(section.y(section.x0)) - 10); }
    });
    // the unbraked ride's last position
    const px = r.world.runner.x, py = r.world.runner.y;
    c.fillStyle = r.world.outcome === 'cleared' ? '#16a34a' : off ? '#dc2626' : stall ? '#f59e0b' : '#16a34a';
    const offX = off ? (off.detail!.x as number) : stall ? (stall.detail!.x as number) : Math.min(px, rails.x1);
    const offSection = off ? Number(off.detail!.segment ?? 0) : 0, offRails = railsList[Math.min(offSection, railsList.length - 1)];
    c.beginPath(); c.arc(v.sx(offX), v.sy(stall ? (stall.detail!.height as number) : offRails.y(offX)), 8, 0, Math.PI * 2); c.fill();
    void py;
    allPoints().forEach((p, i) => {
      const stopped = i === drag && block !== '';
      c.fillStyle = stopped ? '#f0a020' : i === drag ? '#0f6b5c' : '#fff'; c.strokeStyle = stopped ? '#7a4a00' : '#0f6b5c'; c.lineWidth = 3; c.beginPath(); c.arc(v.sx(p[0]), v.sy(p[1]), stopped ? 9 : 7, 0, Math.PI * 2); c.fill(); c.stroke();
      if (stopped) {
        c.font = '600 13px system-ui'; const w = c.measureText(block).width + 14, lx = Math.min(Math.max(4, v.sx(p[0]) + 14), W - w - 4), ly = Math.max(4, v.sy(p[1]) - 34);
        c.fillStyle = '#7a4a00'; c.fillRect(lx, ly, w, 22); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(block, lx + 7, ly + 15);
      }
    });
    document.documentElement.dataset.coDots = JSON.stringify(allPoints().map((p) => [v.sx(p[0]), v.sy(p[1])])); // for the browser check
    // the verdict
    const ok = r.world.outcome === 'cleared';
    verdict.style.borderLeftColor = ok ? '#16a34a' : off ? '#dc2626' : '#f59e0b';
    if (ok) verdict.textContent = r.events.some((e) => e.type === 'cart-catch') ? 'The cart flies the gap and lands on the next track section.' : 'The cart rolls all the way home with no brake.';
    else if (off) {
      const x = off.detail!.x as number;
      const braked = segments.length === 1 && searchIdealRun(coasterCourse('t', segments, push)).cleared;
      verdict.textContent = `The cart leaves the rails at ${x.toFixed(0)} m and does ${(off.detail!.v as number).toFixed(1)} m/s. ${braked ? 'It can stay on the track if you brake before the crest.' : segments.length > 1 ? 'It does not reach the next section yet: move it closer or lower.' : 'It does not land safely on the track yet.'}`;
    } else if (stall) verdict.textContent = `The cart runs out of speed on the hill at ${(stall.detail!.x as number).toFixed(0)} m (${(stall.detail!.height as number).toFixed(1)} m high): it can only climb as high as it started, plus a little from the push.`;
    else verdict.textContent = 'The cart has not finished: check the track.';
    playEl.href = `?${trackToQuery(segments, push)}`;
    pushV.textContent = push.toFixed(1);
    document.documentElement.dataset.coaster = JSON.stringify({ outcome: r.world.outcome, points: allPoints().length, segments: segments.length, off: !!off, catch: r.events.some((e) => e.type === 'cart-catch'), stall: !!stall });
  }

  let block = '';
  const hit = (e: PointerEvent): number => {
    const b = cv.getBoundingClientRect(), v = view();
    const mx = ((e.clientX - b.left) / b.width) * W, my = ((e.clientY - b.top) / b.height) * H;
    return allPoints().findIndex((p) => Math.hypot(v.sx(p[0]) - mx, v.sy(p[1]) - my) < 14);
  };
  const toWorld = (e: PointerEvent): [number, number] => {
    const b = cv.getBoundingClientRect(), v = view();
    return [v.ix(((e.clientX - b.left) / b.width) * W), v.iy(((e.clientY - b.top) / b.height) * H)];
  };
  cv.addEventListener('pointerdown', (e) => { const i = hit(e); if (i >= 0) { drag = i; cv.setPointerCapture(e.pointerId); draw(); } });
  cv.addEventListener('pointermove', (e) => {
    if (drag < 0) { cv.style.cursor = hit(e) >= 0 ? 'grab' : 'default'; return; }
    const [x, y] = toWorld(e);
    const { s, p } = locate(drag), section = segments[s], previousX = p > 0 ? section[p - 1][0] + 1 : s > 0 ? segments[s - 1].at(-1)![0] + 1 : -50, nextX = p < section.length - 1 ? section[p + 1][0] - 1 : s < segments.length - 1 ? segments[s + 1][0][0] - 1 : 400;
    const wantX = Math.round(x * 4) / 4, wantY = Math.round(y * 4) / 4;
    section[p] = [Math.min(nextX, Math.max(previousX, wantX)), Math.max(0, wantY)];
    // plain feedback at the dot while a drag is stopped (CC-244): amber dot, the reason, a not-allowed cursor; gone on release
    block = wantY < -0.005 ? 'ground level: a coaster point goes no lower' : wantX < previousX - 0.005 || wantX > nextX + 0.005 ? 'too close to the next dot' : '';
    cv.style.cursor = block ? 'not-allowed' : 'grabbing';
    if (block) document.documentElement.dataset.dotBlock = block; else delete document.documentElement.dataset.dotBlock;
    draw();
  });
  cv.addEventListener('pointerup', () => { drag = -1; block = ''; cv.style.cursor = 'grab'; delete document.documentElement.dataset.dotBlock; draw(); });
  cv.addEventListener('dblclick', (e) => {
    const b = cv.getBoundingClientRect();
    const i = hit(e as unknown as PointerEvent);
    if (i >= 0) {
      const at = locate(i), section = segments[at.s];
      if (section.length > (segments.length === 1 ? 3 : 2)) section.splice(at.p, 1);
    }
    else {
      const [x, y] = [view().ix(((e.clientX - b.left) / b.width) * W), view().iy(((e.clientY - b.top) / b.height) * H)];
      const si = segments.findIndex((section) => x > section[0][0] && x < section.at(-1)![0]);
      if (si >= 0 && allPoints().length < 32) {
        const section = segments[si]; section.push([Math.round(x * 4) / 4, Math.max(0, Math.round(y * 4) / 4)]); section.sort((a, b2) => a[0] - b2[0]);
        if (y < -0.005) { steps.textContent = 'ground level: a coaster point goes no lower'; draw(); return; }
      }
    }
    steps.textContent = ''; draw();
  });
  pushEl.oninput = () => { push = Number(pushEl.value); draw(); };
  (root.querySelector('#coaddsegment') as HTMLButtonElement).onclick = () => {
    if (allPoints().length + 2 > 32) { steps.textContent = 'This track has reached the 32 point limit.'; return; }
    const lastSection = segments.at(-1)!, [x, y] = lastSection.at(-1)!;
    const startX = x + 4, startY = Math.max(0, y - 1);
    if (startX + 8 > 400) { steps.textContent = 'There is no room to add another section before 400 m.'; return; }
    segments.push([[startX, startY], [startX + 8, startY]]);
    steps.textContent = 'New section added 4 m ahead. Drag its dots to set the landing track.';
    draw();
  };
  (root.querySelector('#coremove') as HTMLButtonElement).onclick = () => {
    if (segments.length > 1) { segments.pop(); steps.textContent = 'Removed the last track section.'; draw(); }
  };
  (root.querySelector('#cofix') as HTMLButtonElement).onclick = () => {
    if (segments.length > 1) { steps.textContent = 'Fix it currently adjusts one continuous track. Shape each section so the cart can land on the next one.'; return; }
    const f = fixCart(segments[0], push);
    steps.textContent = f.ok ? (f.steps.length ? f.steps.join(' ') : 'Nothing to fix: this track already rolls home.') : 'No small change makes this track roll home: try a higher first hill.';
    if (f.ok) segments[0] = f.pts;
    draw();
  };
  addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) location.href = '?'; });
  pushEl.value = String(push);
  draw();
  return { backend: 'webgl2' };
}
