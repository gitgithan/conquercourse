import * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import { secondsWords } from '../../share/challenge';
import { MARKER_BELOW, RUNNER_M, TICKS_PER_FRAME, clipCameraDistance, clipCrop, clipFrames, clipLayoutFor, createClipEncoder, drawClipFrame, clipViewMetres } from '../../share/clip';
import { clipCard } from '../../share/share-ui';
import { pageSearch } from '../../flags';
import { DT } from '../../sim/units';
import type { InputLog } from '../../sim/replay';
import type { CourseState } from './state';

// The clip maker (CC-129, CC-133): a run played again on a stepped clock, four ticks for each picture, whatever the speed of this computer.
// While it works, `st.clip.on` is set: the frame loop then takes its keys from the fed log, counts nothing and makes no sound, and the camera uses the clip's own view.
export interface ClipDeps {
  renderer: THREE.WebGPURenderer;
  camera: THREE.PerspectiveCamera;
  course: CourseData;
  st: CourseState;
  restart(x?: number): void;
  frame(now: number, stepped?: boolean): void; // the game loop's frame; stepped is true for the pictures of the clip
  timeScale: number;
  setFeed(f: { log: InputLog; i: number; left: number } | null): void; // the keys the loop plays instead of the player's
}

export function createClipMaker(deps: ClipDeps): (log: InputLog, ticks: number, from?: number) => Promise<void> {
  const { renderer, camera, course, st } = deps;
    return async function makeClip(log: InputLog, ticks: number, from: number = course.startX): Promise<void> {
      const card = clipCard();
      card.say('Making your clip…');
      st.clip.layout = clipLayoutFor(pageSearch());
      const L = st.clip.layout, enc = await createClipEncoder(L);
      if (!enc) { card.fail('This browser cannot make a video clip. Copy the challenge link instead.'); return; }
      const cv = document.createElement('canvas'); cv.width = L.w; cv.height = L.h;
      const ctx = cv.getContext('2d')!, dom = renderer.domElement, total = clipFrames(ticks);
      const text = { course: course.name, time: secondsWords(ticks), address: 'conquercourse.pages.dev' };
      let n = 0, pending: Promise<void> = Promise.resolve();
      try {
        st.clip.on = true; st.clip.cam = null; st.paused = false; st.keys.clear();
        deps.restart(from);
        deps.setFeed({ log, i: 0, left: 0 });
        let smallest = 1;
        st.clip.hook = () => {
          // how tall the standing runner is in this picture, as a share of the picture's height (the camera has settled by the third picture)
          const feet = new THREE.Vector3(st.world.runner.x, st.world.runner.y, 0).project(camera), head = new THREE.Vector3(st.world.runner.x, st.world.runner.y + RUNNER_M, 0).project(camera);
          const share = (Math.abs(head.y - feet.y) / 2) * dom.height * (L.band.h / clipCrop(dom.width, dom.height, L).h) / L.h;
          const small = L.viewM !== null && share < MARKER_BELOW; // a small runner gets a soft ring
          const mid = new THREE.Vector3(st.world.runner.x, st.world.runner.y + RUNNER_M / 2, 0).project(camera);
          drawClipFrame(ctx, dom, dom.width, dom.height, text, L, small ? { x: ((mid.x + 1) / 2) * dom.width, y: ((1 - mid.y) / 2) * dom.height, r: 0.9 * ((Math.abs(head.y - feet.y) / 2) * dom.height) + 10 } : undefined);
          if (n > 2) smallest = Math.min(smallest, share);
          pending = enc.add(cv, n++);
        };
        const step = (TICKS_PER_FRAME * DT * 1000 + 0.001) / deps.timeScale;
        let t = st.last;
        for (let k = 0; k < total; k++) {
          t += step; await new Promise<void>((done) => requestAnimationFrame(() => { deps.frame(t, true); done(); })); await pending; // drawn inside a real animation frame: the renderer refreshes some camera values only once per frame
          if (k % 8 === 0) { card.say(`Making your clip… ${Math.round((100 * k) / total)}%`); await new Promise((r) => setTimeout(r, 0)); }
        }
        const blob = await enc.finish();
        card.done(blob, 'conquercourse-run.mp4', `Your clip is ready (${(blob.size / 1e6).toFixed(1)} MB).`);
        document.documentElement.dataset.clip = String(blob.size);
        document.documentElement.dataset.clipRunner = smallest.toFixed(3);
        document.documentElement.dataset.clipMetres = clipViewMetres(dom.width, dom.height, clipCameraDistance(dom.width, dom.height, L), L).toFixed(1); // metres of course across the picture
        (window as unknown as { __clip?: Blob }).__clip = blob;
      } catch (e) {
        card.fail('The clip could not be made on this computer. Copy the challenge link instead.');
        console.warn('clip failed', e);
      } finally {
        st.clip.on = false; st.clip.cam = null; st.clip.hook = null; deps.setFeed(null); st.acc = 0;
        deps.restart(course.startX); st.last = performance.now();
        requestAnimationFrame(deps.frame);
      }
    }
}
