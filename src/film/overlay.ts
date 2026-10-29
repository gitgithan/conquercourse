// The film side of a shot (CC-130): the clock, the clean screen, and for the hero shot the real photo that fades into the built place.
// Loaded only with ?film=<shot>, so play never pays for it.
import { Vector3, type PerspectiveCamera } from 'three';
import { SHOT_SECONDS, filmPose, heroPhotoOpacity, type FilmCtx, type FilmShot, type Pose } from './camera';

export interface Film {
  t(): number; // seconds since the film started (the stepped clock when filming)
  pose(c: Omit<FilmCtx, 'finishX' | 'focusX' | 'focusY' | 'macroDist'>): Pose;
  tick(camera: PerspectiveCamera): void; // call once a frame, after the camera is placed: keeps the screen clean, the photo fading and the labels attached
}

// Params: ?film=hero&photo=/assets/park/park01.jpg&box=294,183,658,454&size=1024,760&label=handrail&credit=Photo+by+...,+CC0&filmx=12&filmy=0.7
export function startFilm(shot: FilmShot, params: URLSearchParams, canvas: HTMLCanvasElement, finishX: number): Film {
  let t0 = performance.now();
  (window as unknown as { __filmZero: () => void }).__filmZero = () => { t0 = performance.now(); }; // film.mjs --skip: the film starts counting here
  const t = () => (performance.now() - t0) / 1000;
  const isMacro = shot === 'macro'; // macro: filmx and filmy are the part's offset from the runner, md is the distance
  const focusX = Number(params.get('filmx') ?? (isMacro ? 0.2 : finishX / 2)), focusY = Number(params.get('filmy') ?? (isMacro ? 1 : 0.6)), macroDist = Number(params.get('md') ?? 2);
  const timeScale = params.get('dur') ? SHOT_SECONDS[shot] / Number(params.get('dur')) : 1; // ?dur=2.2 plays the whole move in 2.2 s (a fast drone dash)
  document.documentElement.dataset.film = shot;

  let photo: HTMLDivElement | null = null, img: HTMLImageElement | null = null, boxEl: HTMLDivElement | null = null, tag: HTMLDivElement | null = null;
  const src = params.get('photo');
  if (shot === 'hero' && src) {
    photo = document.createElement('div');
    photo.className = 'film-keep';
    photo.style.cssText = 'position:fixed;inset:0;z-index:50;background:#111;overflow:hidden;pointer-events:none';
    img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
    boxEl = document.createElement('div');
    boxEl.style.cssText = 'position:absolute;border:3px solid #ffd23f;border-radius:4px;box-shadow:0 0 0 2px rgba(0,0,0,.35)';
    tag = document.createElement('div');
    tag.style.cssText = 'position:absolute;font:600 22px system-ui,sans-serif;color:#111;background:#ffd23f;padding:2px 10px;border-radius:4px';
    const credit = document.createElement('div');
    credit.textContent = params.get('credit') ?? '';
    credit.style.cssText = 'position:absolute;left:16px;bottom:12px;font:14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000';
    photo.append(img, boxEl, tag, credit);
    document.body.appendChild(photo);
  }

  // Labels: a data file of 3D anchors; each frame the anchor is projected through the real camera, so the callout stays on its part.
  // Params: ?labels=/film/park-run.labels.json  (see docs/film-toolchain.md for the format)
  interface Label { id: string; text: string; idea?: string; at: [number, number, number]; from: number; to: number; dx?: number; dy?: number }
  let labels: Label[] = [];
  const layer = document.createElement('div');
  layer.className = 'film-keep';
  layer.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;font-family:system-ui,sans-serif';
  document.body.appendChild(layer);
  const els = new Map<string, { dot: HTMLDivElement; line: HTMLDivElement; box: HTMLDivElement }>();
  const labelsUrl = params.get('labels');
  if (labelsUrl) fetch(labelsUrl).then((r) => r.json()).then((j: { labels: Label[] }) => {
    labels = j.labels;
    for (const l of labels) {
      const dot = document.createElement('div'), line = document.createElement('div'), box = document.createElement('div');
      dot.style.cssText = 'position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#ffd23f;box-shadow:0 0 18px 8px rgba(255,210,63,.65)';
      line.style.cssText = 'position:absolute;height:3px;background:#ffd23f;transform-origin:0 50%';
      box.style.cssText = 'position:absolute;background:rgba(17,17,17,.82);color:#fff;border-left:5px solid #ffd23f;padding:6px 14px;border-radius:4px;white-space:nowrap';
      box.innerHTML = `<div style="font:700 26px system-ui">${l.text}</div>${l.idea ? `<div style="font:400 18px system-ui;opacity:.9">${l.idea}</div>` : ''}`;
      layer.append(line, dot, box);
      els.set(l.id, { dot, line, box });
    }
  });
  const v = new Vector3();
  const track = (camera: PerspectiveCamera) => {
    camera.updateMatrixWorld();
    const W = innerWidth, H = innerHeight, now = t(), out: Record<string, [number, number]> = {};
    for (const l of labels) {
      const e = els.get(l.id)!;
      const a = Math.min(1, Math.max(0, (now - l.from) / 0.4)) * Math.min(1, Math.max(0, (l.to - now) / 0.4));
      v.set(...l.at).project(camera);
      const on = a > 0 && v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      for (const k of [e.dot, e.line, e.box]) k.style.opacity = on ? String(a) : '0';
      if (!on) continue;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H, bx = x + (l.dx ?? 90), by = y + (l.dy ?? -90);
      out[l.id] = [x, y];
      e.dot.style.left = `${x}px`; e.dot.style.top = `${y}px`;
      const len = Math.hypot(bx - x, by - y);
      e.line.style.left = `${x}px`; e.line.style.top = `${y}px`; e.line.style.width = `${len * Math.min(1, a * 1.5)}px`;
      e.line.style.transform = `rotate(${Math.atan2(by - y, bx - x)}rad)`;
      e.box.style.left = `${bx}px`; e.box.style.top = `${by - 24}px`;
    }
    (window as unknown as { __filmTrack: unknown }).__filmTrack = { t: now, points: out }; // read by scripts/film.mjs --track for the Remotion callouts
  };

  let frame = 0;
  const hideChrome = () => { // everything beside the canvas goes: panels, hud, toasts
    let n: HTMLElement | null = canvas;
    while (n && n !== document.body) {
      for (const s of Array.from(n.parentElement!.children) as HTMLElement[]) {
        if (s !== n && !s.classList.contains('film-keep') && s.tagName !== 'SCRIPT' && s.tagName !== 'STYLE') s.style.display = 'none';
      }
      n = n.parentElement;
    }
  };
  const layout = () => {
    if (!photo || !img || !boxEl || !tag) return;
    const [iw, ih] = (params.get('size') ?? '1024,760').split(',').map(Number);
    const W = innerWidth, H = innerHeight, k = Math.max(W / iw, H / ih), ox = (W - iw * k) / 2, oy = (H - ih * k) / 2;
    img.style.width = `${iw}px`; img.style.height = `${ih}px`;
    const drift = 1 + 0.04 * Math.min(1, t() / 4); // a slow push in on the photo while it is alone
    img.style.transform = `translate(${ox}px,${oy}px) scale(${k * drift})`;
    const b = params.get('box')?.split(',').map(Number);
    if (b && b.length === 4) {
      const x = ox + b[0] * k * drift, y = oy + b[1] * k * drift;
      boxEl.style.cssText += `;left:${x}px;top:${y}px;width:${(b[2] - b[0]) * k * drift}px;height:${(b[3] - b[1]) * k * drift}px`;
      tag.style.left = `${x}px`; tag.style.top = `${y - 36}px`; tag.textContent = params.get('label') ?? '';
    }
  };
  return {
    t,
    pose: (c) => { (window as unknown as { __filmRunner: unknown }).__filmRunner = { x: c.runnerX, y: c.runnerY }; return filmPose(shot, t() * timeScale, { ...c, finishX, focusX, focusY, macroDist }); },
    tick: (camera) => {
      frame++; hideChrome(); track(camera);
      if (photo) { layout(); const o = heroPhotoOpacity(t()); photo.style.opacity = String(o); photo.style.display = o <= 0 ? 'none' : 'block'; if (boxEl) boxEl.style.opacity = String(Math.min(1, o * 2) * (t() > 0.6 ? 1 : t() / 0.6)); }
    },
  };
}
