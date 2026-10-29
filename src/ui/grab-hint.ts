import * as THREE from 'three';
import type { CourseData } from '../course/course';
import { heightAt } from '../sim/terrain';
import { findClimb } from '../sim/climb';
import type { WorldState } from '../sim/world';

// The grab hint (CC-168): a bright rim on the top edge of a wall the hands would catch right now, so a player can tell which ledges answer to E.
// It shows while the hold key is down, or while the runner is in the air within reach (the key is about to be needed). ?grabhint=0 hides it.
export function createGrabHint(scene: THREE.Scene, course: CourseData, enabled = true) {
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.09, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, depthTest: false }),
  );
  rim.renderOrder = 20;
  rim.visible = false;
  scene.add(rim);
  const edges = course.terrain.platforms;
  // 'Hold E to grab' on the warped wall, bright on dark like the HUD, while the hands are near the top and E is not down
  const tip = document.createElement('div');
  tip.textContent = 'Hold E to grab';
  tip.style.cssText = 'position:fixed;left:50%;top:30%;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(20,18,16,.82);color:#fff1b0;font:600 18px system-ui,sans-serif;pointer-events:none;display:none;z-index:30';
  document.body.append(tip);
  return {
    // The ledge the hands would take now, or null (also what the check reads).
    target(w: WorldState): { edge: number; top: number } | null {
      if (!enabled || w.mode !== 'run' || w.outcome !== 'running') return null;
      const r = w.runner;
      const c = findClimb(course.terrain, r.x, r.y, r.vx, r.vy, course.jumpSpeed);
      return c ? { edge: c.edge, top: c.top } : null;
    },
    update(w: WorldState, holding: boolean, nowMs: number): void {
      const gt = w.wall?.result.grabTick;
      tip.style.display = enabled && w.mode === 'wall' && !holding && !w.wall?.held && course.wall?.needE !== false && gt != null && w.wall!.index >= gt - 90 && w.wall!.index < gt ? 'block' : 'none';
      const t = this.target(w);
      const show = t !== null;
      rim.visible = show;
      if (!show || !t) return;
      rim.position.set(t.edge + 0.05, heightAt(edges.find((p) => p.x0 === t.edge)!, t.edge) + 0.02, 0);
      (rim.material as THREE.MeshBasicMaterial).opacity = holding ? 0.95 : 0.55 + 0.25 * Math.sin(nowMs / 160);
    },
    dispose(): void { scene.remove(rim); tip.remove(); rim.geometry.dispose(); (rim.material as THREE.Material).dispose(); },
  };
}
