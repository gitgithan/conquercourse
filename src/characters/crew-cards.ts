// The Meet the crew cards (owner request, 2026-11-03): the ten built-in characters, each with a name and a short animated run loop.
// The data below is pure (tests read it); the loop uses ONE small renderer for all cards and copies each frame into that card's canvas.
// A card is drawn only while it is on screen; closing the dialog stops the loop and frees the renderer. If the 3D part fails, the still picture stays.
import { CAST_BASE, castUrl } from './cast';
import { VOICES } from '../ui/says';

export interface CrewCard {
  /** A stable key: the cast id, or rookie-a / rookie-b. */
  key: string;
  name: string;
  /** The picture shown first (the T-pose), and kept if the 3D loop cannot run. */
  thumb: string | null;
  /** The model file for a cast character; null for a Rookie. */
  model: string | null;
  rookie: 'a' | 'b';
  /** Card colour. */
  accent: string;
  /** One line under the name. */
  blurb: string;
}

interface CastItem { id: string; name: string; prompt: string; thumb: string }

/** Ten cards: the eight starter cast first, then the two Rookies. Names come from the cast list and the Rookie voices, never typed twice. */
export function crewCards(items: CastItem[]): CrewCard[] {
  const cast = items.map((c): CrewCard => ({ key: c.id, name: c.name, thumb: `${CAST_BASE}/${c.thumb}`, model: castUrl(c.id), rookie: 'a', accent: '#0f6b5c', blurb: c.prompt }));
  const rookie = (r: 'a' | 'b', v: 'pip' | 'juno'): CrewCard => ({ key: `rookie-${r}`, name: VOICES[v].name, thumb: `${CAST_BASE}/${v}.webp`, model: null, rookie: r, accent: VOICES[v].accent, blurb: VOICES[v].poweredBy });
  return [...cast, rookie('a', 'pip'), rookie('b', 'juno')];
}

export async function loadCrewCards(fetcher: typeof fetch = fetch): Promise<CrewCard[]> {
  try {
    const r = await fetcher(`${CAST_BASE}/index.json`);
    if (!r.ok) return [];
    return crewCards(((await r.json()) as { items: CastItem[] }).items);
  } catch { return []; }
}

const SIZE = 200, FPS = 24, SPEED = 6; // px per side of a card picture, frames per second, metres per second of the run

export interface CrewLoop { stop(): void }

/** Starts the loop for the given canvases (key -> canvas). Resolves to a handle at once; cards turn animated as their characters load. */
export function startCrewLoop(cards: CrewCard[], canvases: Map<string, HTMLCanvasElement>, root: HTMLElement): CrewLoop {
  let stopped = false, raf = 0;
  const cleanups: (() => void)[] = [];
  const stop = () => { stopped = true; cancelAnimationFrame(raf); cleanups.forEach((c) => c()); cleanups.length = 0; };
  void (async () => {
    try {
      const THREE = await import('three/webgpu');
      const { createRookieActor } = await import('../render/actor');
      if (stopped) return;
      const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
      await renderer.init();
      if (stopped) { renderer.dispose(); return; }
      renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE); renderer.setClearColor(0x000000, 0);
      cleanups.push(() => renderer.dispose());
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a80, 1.7));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 5); scene.add(sun);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0.95, 4.6); camera.lookAt(0, 0.9, 0);
      const actors = new Map<string, { object: { visible: boolean; position: { set(x: number, y: number, z: number): void }; rotation: { y: number } }; update(s: never): void; dispose(): void }>();
      const visible = new Set<string>();
      const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((es) => { for (const e of es) { const k = (e.target as HTMLElement).dataset.key!; if (e.isIntersecting) visible.add(k); else visible.delete(k); } }, { root, threshold: 0.05 });
      for (const [k, cv] of canvases) { io?.observe(cv); if (!io) visible.add(k); }
      cleanups.push(() => { io?.disconnect(); for (const a of actors.values()) a.dispose(); });
      const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t0 = performance.now();
      let last = -1;
      const draw = (k: string, tick: number) => {
        const a = actors.get(k), cv = canvases.get(k); if (!a || !cv) return;
        a.update({ tick, x: SPEED * tick / 60, y: 0, vx: SPEED, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 } as never);
        a.object.position.set(0, 0, 0); a.object.rotation.y = -0.55;
        for (const o of actors.values()) o.object.visible = false;
        a.object.visible = true;
        renderer.render(scene, camera);
        cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
        cv.getContext('2d')?.drawImage(renderer.domElement, 0, 0, cv.width, cv.height);
        cv.dataset.live = 'true';
      };
      const frame = (now: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(frame);
        const f = Math.floor((now - t0) / (1000 / FPS));
        if (f === last || document.hidden || reduced) return;
        last = f;
        for (const k of visible) draw(k, f * (60 / FPS));
      };
      raf = requestAnimationFrame(frame);
      for (const c of cards) { // load one by one so the first cards move early; a card that fails keeps its picture
        if (stopped) return;
        try {
          const a = await createRookieActor(scene as never, { rookie: c.rookie, url: c.model ?? undefined, fit: c.model !== null });
          if (stopped) { a.dispose(); return; }
          actors.set(c.key, a as never); a.object.visible = false;
          draw(c.key, 0);
        } catch { /* keep the still picture */ }
      }
    } catch { /* no 3D here: the still pictures stay */ }
  })();
  return { stop };
}
