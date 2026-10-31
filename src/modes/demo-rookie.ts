// ?demo=rookie[&rookie=a|b]: a Rookie runs along a straight path, leaps, lands and runs on (side camera).
// Keys/buttons: A and B switch Rookie. Game time is the tick count; the tick comes from performance.now only.
import { Vector3 } from 'three/webgpu';
import { loadClip, type Clip, type Phase } from '../motion/clip';
import { DemoMotion, legLength, type Clips } from '../motion/timeline';
import { TICKS_PER_SECOND } from '../sim/units';
import { loadRookie, skinStretch, type PosedRookie, type RookieId } from '../render/rookie';
import { createStage } from '../render/scene';
import { pageQuery } from '../flags';

const PHASES: Phase[] = ['run', 'leap', 'land', 'hang', 'swing'];

export async function startRookieDemo(): Promise<void> {
  const params = pageQuery();
  const stage = await createStage(document.body, false);
  const clips = Object.fromEntries(await Promise.all(PHASES.map(async (p) => [p, await loadClip(p)]))) as Record<Phase, Clip>;
  const run = clips.run;
  const rookies = {} as Record<RookieId, PosedRookie>;
  for (const id of ['a', 'b'] as const) {
    rookies[id] = await loadRookie(id, run.names, run.parents, '/assets/characters', id === 'a' ? params.get('body') ?? undefined : undefined, params.get('fit') !== '0'); // fit=0 shows the made body as it came, for the before picture // ?body=<glb url> puts another body on the 34 bones in Rookie A's place (CC community characters trial)
    stage.scene.add(rookies[id].object);
  }
  const clipLeg = legLength(run.names, (i) => new Vector3(...run.frames[0][i]));
  const motions = Object.fromEntries(
    (['a', 'b'] as const).map((id) => [id, new DemoMotion(clips as Clips, rookies[id].legLength / clipLeg)]),
  ) as Record<RookieId, DemoMotion>;

  let current: RookieId = params.get('rookie') === 'b' ? 'b' : 'a';
  const choose = (id: RookieId) => {
    current = id;
    for (const k of ['a', 'b'] as const) rookies[k].object.visible = k === id;
    document.documentElement.dataset.rookie = id;
  };
  choose(current);

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:12px;left:12px;display:flex;gap:8px;font:16px sans-serif';
  for (const id of ['a', 'b'] as const) {
    const b = document.createElement('button');
    b.textContent = `Rookie ${id.toUpperCase()}`;
    b.onclick = () => choose(id);
    bar.appendChild(b);
  }
  if (!params.has('pose')) document.body.appendChild(bar);
  addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'b') choose(e.key);
  });

  const show = (tick: number) => {
    const m = motions[current];
    const pose = m.pose(tick);
    rookies[current].apply(pose.joints);
    stage.camera.position.set(pose.hips.x, 1.1, 4.6);
    stage.camera.lookAt(pose.hips.x, 0.95, 0);
    document.documentElement.dataset.phase = pose.phase;
    return pose;
  };
  // test hooks: pose by tick, and read where the bones ended up (clip axes: run +z, left +x)
  Object.assign(window, {
    __poseTick: (tick: number, id?: RookieId) => {
      if (id) choose(id);
      const pose = show(tick);
      const bones = rookies[current].world();
      return {
        phase: pose.phase,
        hips: pose.hips,
        lift: rookies[current].lift,
        joints: bones.map((p) => [-p.z, p.y, p.x]),
        target: pose.joints.map((p) => [-p.z, p.y, p.x]),
      };
    },
    // worst stretch of any triangle edge against the bind pose, for the shown body (1 = nothing moved; a body that explodes shows several)
    __skinStretch: () => skinStretch(rookies[current].object),
    __fit: () => rookies[current].fit,
    // the bind pose (T-pose) seen from the front, for the before and after pictures
    __rest: (id?: RookieId, side?: boolean) => {
      if (id) choose(id);
      const r = rookies[current];
      r.apply(r.rig.bones.map((b) => b.restPos.clone()), { floor: false });
      stage.camera.position.set(side ? -3.6 : 0, 1.0, side ? 0 : 3.6); // side: seen from the left, so the runner's front is on the right of the picture
      stage.camera.lookAt(0, 0.9, 0);
    },
    __period: motions.a.period,
  });

  const start = performance.now();
  stage.renderer.setAnimationLoop(() => {
    if (!params.has('pose')) show(Math.floor(((performance.now() - start) / 1000) * TICKS_PER_SECOND));
    stage.renderer.render(stage.scene, stage.camera);
  });
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
}
