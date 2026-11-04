import { courseListen } from '../modes/course/lifetime';
import { pageQuery } from '../flags';
// The performance overlay (CC-75): ?perf=1 shows it, key P toggles it, in the Course, the editor 3D view and the map.
// It shows the frame time and fps, draw calls, triangles, how many meshes and instances are in the scene, the renderer and the
// simulator step cost, and writes the same numbers to <html data-perf> as JSON so scripts/perf-check.mjs can read them.
// It needs no three import: it reads renderer.info and walks the scene by duck typing.
interface RenderInfo { render: { calls?: number; drawCalls?: number; triangles?: number }; memory: { geometries: number; textures: number } }
interface Walkable { traverse(f: (o: { isMesh?: boolean; isInstancedMesh?: boolean; count?: number; visible?: boolean }) => void): void }

export interface PerfSource {
  label: string; // "Course", "Editor", "Map"
  backend: string; // "webgpu", "webgl2"
  renderer?: { info: RenderInfo };
  scene?: Walkable;
  onDemand?: boolean; // the editor draws only when something changes, so fps counts draws, not animation frames
}
export interface PerfSample {
  label: string; backend: string; frameMs: number; fps: number; renderMs: number; simMs: number;
  calls: number; triangles: number; meshes: number; instancedMeshes: number; instances: number; geometries: number; textures: number; heapMB: number;
}
export interface Perf { frame(now?: number): void; simStart(): void; simEnd(): void; renderStart(): void; renderEnd(): void; sample(): PerfSample; toggle(): void; readonly shown: boolean }

const heapMB = (): number => { const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory; return m ? Math.round(m.usedJSHeapSize / 1048576) : 0; };

export function createPerf(src: PerfSource): Perf {
  const wanted = pageQuery().get('perf');
  let shown = wanted === '1' || wanted === 'true';
  const box = document.createElement('div');
  box.id = 'perf';
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;font:11px/1.35 ui-monospace,Menlo,monospace;color:#d8f5e8;background:rgba(10,20,16,.82);padding:5px 8px;border-radius:6px;pointer-events:none;white-space:pre;display:none';
  document.body.appendChild(box);
  const ema = (old: number, v: number, k = 0.1) => (old === 0 ? v : old + (v - old) * k);
  let frameMs = 0, renderMs = 0, simMs = 0, lastNow = 0, simT = 0, simAcc = 0, renderT = 0, calls = 0, triangles = 0, geometries = 0, textures = 0;
  let meshes = 0, instancedMeshes = 0, instances = 0, scanAt = 0, outAt = 0;
  const scan = () => {
    meshes = instancedMeshes = instances = 0;
    src.scene?.traverse((o) => {
      if (o.visible === false) return;
      if (o.isInstancedMesh) { instancedMeshes++; instances += o.count ?? 0; } else if (o.isMesh) meshes++;
    });
  };
  const publish = (): PerfSample => ({
    label: src.label, backend: src.backend, frameMs: +frameMs.toFixed(2), fps: frameMs > 0 ? +(1000 / frameMs).toFixed(1) : 0, renderMs: +renderMs.toFixed(2), simMs: +simMs.toFixed(3),
    calls, triangles, meshes, instancedMeshes, instances, geometries, textures, heapMB: heapMB(),
  });
  const show = () => {
    const s = publish();
    box.textContent = `${s.label} · ${s.backend}${src.onDemand ? ' (draws on change)' : ''}\n`
      + `${s.frameMs.toFixed(1)} ms/frame · ${s.fps.toFixed(0)} fps · render ${s.renderMs.toFixed(1)} ms${s.label === 'Course' ? ` · sim ${s.simMs.toFixed(2)} ms` : ''}\n`
      + (src.renderer ? `draws ${s.calls} · triangles ${s.triangles.toLocaleString()}\n` : 'draws and triangles: not available in the map (MapLibre)\n')
      + `meshes ${s.meshes} · instanced ${s.instancedMeshes} (${s.instances.toLocaleString()} instances)\n`
      + `geometries ${s.geometries} · textures ${s.textures}${s.heapMB ? ` · heap ${s.heapMB} MB` : ''}`;
  };
  const toggle = () => { shown = !shown; box.style.display = shown ? 'block' : 'none'; if (shown) show(); };
  box.style.display = shown ? 'block' : 'none';
  courseListen(window, 'keydown', (e) => {
    if (e.code !== 'KeyP' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    toggle();
  });
  const out = (now: number) => {
    if (!shown && wanted === null) return; // nothing asked for it: no work
    if (now - scanAt > 500) { scanAt = now; scan(); }
    if (now - outAt > 250) {
      outAt = now;
      document.documentElement.dataset.perf = JSON.stringify(publish());
      if (shown) show();
    }
  };
  return {
    frame(now = performance.now()) { if (lastNow) frameMs = ema(frameMs, now - lastNow); lastNow = now; out(now); },
    simStart() { simT = performance.now(); },
    simEnd() { simAcc += performance.now() - simT; },
    renderStart() { renderT = performance.now(); },
    renderEnd() {
      renderMs = ema(renderMs, performance.now() - renderT);
      simMs = ema(simMs, simAcc); simAcc = 0;
      const info = src.renderer?.info;
      if (info) { calls = info.render.drawCalls ?? info.render.calls ?? 0; triangles = info.render.triangles ?? 0; geometries = info.memory.geometries; textures = info.memory.textures; }
    },
    sample: publish,
    toggle,
    get shown() { return shown; },
  };
}
