import * as THREE from 'three/webgpu';
import type { CourseData } from '../../course/course';
import { filmShotOf, type FilmShot } from '../../film/camera';
import { railsOf } from '../../sim/cart';
import { clipCameraDistance } from '../../share/clip';
import { pageSearch } from '../../flags';
import type { CourseState } from './state';

// The Course's cameras (CC-133): the main camera with its three views (side, 45 degrees, first person; C), the mouse orbit, the film camera (?film=<shot>), the clip's own camera, and the front-view inset.
// startCourse makes it once and calls update() for the placing of the camera and drawFront() for the inset after each picture; this part reads the world through the state and the rest through `deps`.
export type Cam = 'side' | 'angle' | 'first';
export const CAMS: { id: Cam; name: string }[] = [{ id: 'side', name: 'Side view' }, { id: 'angle', name: '45° view' }, { id: 'first', name: 'First person' }];

export interface CameraDeps {
  host: HTMLElement;
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  course: CourseData;
  params: URLSearchParams;
  st: CourseState;
  body(): THREE.Mesh; // the capsule that stands in for the runner
  facing(): 1 | -1;
  actor(): { object: THREE.Object3D } | null; // the Rookie, once loaded
  say(text: string, ticks: number): void;
}

export interface CourseCamera {
  camera: THREE.PerspectiveCamera;
  frontCam: THREE.PerspectiveCamera;
  button: HTMLButtonElement;
  filmShot: FilmShot | null;
  mode(): Cam;
  orbit: { yaw: number; pitch: number; zoom: number };
  pipFrame: HTMLElement;
  nextCam(): void;
  update(): void; // places the camera (and the film camera) for this picture
  drawFront(): void; // the front-view inset, drawn over the picture
}

export async function createCourseCamera(deps: CameraDeps): Promise<CourseCamera> {
  const { host, renderer, scene, course, params, st } = deps;

  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 400);
  // the front view window (bottom right, above the drum lane's row): its frame is a div, its picture a second camera drawn in the same canvas
  const PIP_W = 260, PIP_H = 195, PIP_BOTTOM = 118;
  const frontCam = new THREE.PerspectiveCamera(75, PIP_W / PIP_H, 0.1, 200); // first person: wide, from the eyes
  let camY = 0, camYSet = false; // the camera's height target eases, so a fast dip (as on a plank) does not snap the view
  let pipRoll = 0, pipClock = 0; // the head's turn about the bar (rad) and the clock it settles by
  const pipFrame = document.createElement('div');
  pipFrame.id = 'frontview';
  pipFrame.style.cssText = `position:fixed;right:16px;bottom:${PIP_BOTTOM}px;width:${PIP_W}px;height:${PIP_H}px;box-sizing:border-box;border:3px solid #17201d;border-radius:10px;pointer-events:none;display:none;box-shadow:0 4px 14px #0004`;
  const pipLabel = document.createElement('div');
  pipLabel.textContent = 'Looking ahead (F)';
  pipLabel.style.cssText = 'position:absolute;left:8px;top:6px;font:700 12px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000a';
  pipFrame.appendChild(pipLabel);
  document.body.appendChild(pipFrame);
  let camMode: Cam = params.get('cam') === 'first' ? 'first' : 'side'; // ?cam=first starts in the runner's eyes (for pictures)
  const camPos = new THREE.Vector3();
  camPos.set(5, 3.5, 17);
  let eye = { x: 0, y: 0 }, qRoll = new THREE.Quaternion(); // the eyes and the head's turn of this picture, kept for the inset
  const filmShot = filmShotOf(pageSearch()); // the film camera (CC-130): only with ?film=<shot>
  const film = filmShot ? (await import('../../film/overlay')).startFilm(filmShot, params, renderer.domElement as HTMLCanvasElement, course.finishX) : null;
  let filmAir = 0;
  const camBtn = document.createElement('button');
  camBtn.id = 'cam';
  camBtn.setAttribute('aria-label', 'Change the camera (C)'); camBtn.title = 'Camera: Side view';
  camBtn.style.cssText = 'position:fixed;right:16px;top:56px;display:grid;justify-items:center;gap:0;border:2px solid #17201d;background:#fff;color:#17201d;border-radius:12px;padding:3px 8px 2px;cursor:pointer;font:600 11px system-ui,sans-serif';
  const node = (a: number) => `<circle cx="${(20 + 13 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" cy="${(20 - 13 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" r="4.2" class="n"/>`;
  camBtn.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g id="ring" style="transform-origin:20px 20px;transition:transform .35s ease"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/>${node(0)}${node(120)}${node(240)}</g><path d="M20 2 L24 7 L16 7 Z" fill="#c4572a"/></svg><span id="camname">Rotate Camera (C)</span>`;
  camBtn.querySelectorAll('.n').forEach((n) => { (n as SVGElement).style.fill = '#17201d'; });
  let camTurn = 0;
  const nextCam = () => {
    const next = CAMS[(CAMS.findIndex((c2) => c2.id === camMode) + 1) % CAMS.length];
    camMode = next.id; camTurn += 120; resetOrbit();
    (camBtn.querySelector('#ring') as SVGElement).style.transform = `rotate(${camTurn}deg)`;
    camBtn.title = `Camera: ${next.name}`;
    deps.say(`Camera: ${next.name}`, 100);
    camBtn.blur();
  };
  camBtn.onclick = nextCam;
  // Mouse: drag turns the view around the runner, the wheel zooms, a double-click (or C) goes back to the preset.
  // The numbers are changes on top of the preset view, so zero means the preset exactly.
  // the wheel zooms in to the normal closest view (0.45), and on: the target glides to the head and the camera swings round to the front of the face (about 0.7 m away)
  const FACE_START = 0.45, FACE_END = 0.05, FACE_DIST = 0.7;
  const orbit = { yaw: 0, pitch: 0, zoom: 1 };
  const resetOrbit = () => { orbit.yaw = 0; orbit.pitch = 0; orbit.zoom = 1; };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const dom = renderer.domElement;
  let dragging: { x: number; y: number } | null = null;
  dom.addEventListener('pointerdown', (e) => { if (e.button === 0) { dragging = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); dom.style.cursor = 'grabbing'; } });
  dom.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging = { x: e.clientX, y: e.clientY };
    if (camMode === 'first') { orbit.yaw = clamp(orbit.yaw + dx * 0.006, -1.4, 1.4); orbit.pitch = clamp(orbit.pitch - dy * 0.004, -0.6, 0.6); }
    else { orbit.yaw = clamp(orbit.yaw - dx * 0.006, -1.4, 1.4); orbit.pitch = clamp(orbit.pitch + dy * 0.004, -0.5, 1.0); }
  });
  const stopDrag = () => { dragging = null; dom.style.cursor = 'grab'; };
  dom.addEventListener('pointerup', stopDrag); dom.addEventListener('pointercancel', stopDrag);
  dom.addEventListener('wheel', (e) => { e.preventDefault(); if (camMode !== 'first') orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.001), FACE_END, 1.7); }, { passive: false });
  dom.addEventListener('dblclick', resetOrbit);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.style.cursor = 'grab';

  function update(): void {
    const facing = deps.facing(), actor = deps.actor(), body = deps.body(), r = st.world.runner;
    // the head: the body's turn about the bar (swing angle theta, a rotation so it passes the top smoothly) and where the eyes are; the first-person camera and the corner window both use it.
    // After a release the head settles level over about 0.3 s (the body has no spin in flight); on the ground it is level.
    const nowS = performance.now() / 1000, dtHead = Math.min(0.05, Math.max(0, nowS - pipClock)); pipClock = nowS;
    if (st.world.mode === 'hang' && st.world.hang) pipRoll = st.world.hang.theta;
    else if (!r.grounded) pipRoll *= Math.exp(-dtHead / 0.1);
    else pipRoll = 0;
    qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pipRoll);
    const nose = new THREE.Vector3(0.15 * facing, 0, 0).applyQuaternion(qRoll);
    const headHold = st.world.hang ? course.holds?.[st.world.hang.hold] : undefined;
    eye = headHold && st.world.hang
      ? { x: headHold.x + 0.4 * Math.sin(st.world.hang.theta) + nose.x, y: headHold.y - 0.4 * Math.cos(st.world.hang.theta) + nose.y } // just under the hands, along the arms
      : { x: r.x + nose.x, y: r.y + 1.62 + nose.y };
    // three views, switched with C: from the side, from behind at 45 degrees, and through the runner's eyes
    const fov = camMode === 'first' ? 75 : 40;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (actor) actor.object.visible = camMode !== 'first' && !(((window as unknown as { __filmEye?: number }).__filmEye ?? 0) > 0.85);
    body.visible = !actor && camMode !== 'first' && !(((window as unknown as { __filmEye?: number }).__filmEye ?? 0) > 0.85);
    if (camMode === 'first') {
      camera.position.set(eye.x, eye.y, 0.1);
      const ch = Math.cos(orbit.pitch); // drag turns your head
      const dir = new THREE.Vector3(facing * Math.cos(orbit.yaw) * ch, Math.sin(orbit.pitch) - 0.042, facing * Math.sin(orbit.yaw) * ch).applyQuaternion(qRoll);
      camera.up.set(0, 1, 0).applyQuaternion(qRoll); // the whole view tilts with the body, through the top of a full circle
      camera.lookAt(eye.x + 10 * dir.x, eye.y + 10 * dir.y, 0.1 + 10 * dir.z);
      camPos.copy(camera.position);
    } else if (st.clip.on) {
      // The clip's own camera (CC-137): side-on and close, glued to the runner. It moves once for each picture, so it is the same on every computer.
      const dom = renderer.domElement, L = st.clip.layout, dist = clipCameraDistance(dom.width, dom.height, L);
      const bandM = (L.viewM ?? 0) * L.band.h / L.w, ahead = L.viewM !== null ? 0.2 * L.viewM : 0.45, lift = L.viewM !== null ? 0.17 * bandM : 1.05, slack = L.viewM !== null ? 0.1 * bandM : 0.8;
      // the wide view looks a fifth of the picture ahead of the runner, so the next obstacle is in frame, and keeps the runner low so there is sky for a swing or a jump
      const wantX = r.x + ahead * facing, wantY = r.y + lift;
      if (!st.clip.cam) st.clip.cam = { x: wantX, y: wantY };
      else { // follow quickly, and never let the runner drift more than a metre from the middle (a long fall must not leave the picture)
        st.clip.cam.x = wantX; st.clip.cam.y += (wantY - st.clip.cam.y) * 0.25; // x is locked to the runner so the body does not slide about the picture; y is eased so a bob or a hop is not copied
        st.clip.cam.x = clamp(st.clip.cam.x, wantX - 0.6, wantX + 0.6); st.clip.cam.y = clamp(st.clip.cam.y, wantY - slack, wantY + slack);
      }
      camera.up.set(0, 1, 0);
      camera.position.set(st.clip.cam.x, st.clip.cam.y, dist);
      camera.lookAt(st.clip.cam.x, st.clip.cam.y, 0);
      camPos.copy(camera.position);
    } else {
      camera.up.set(0, 1, 0);
      // the preset is a target point and an offset from it; the mouse turns and scales the offset around the target
      const off = camMode === 'side' ? new THREE.Vector3(0, 1.5, 25) : new THREE.Vector3(-12, 3, 11);
      const ft0 = clamp((FACE_START - orbit.zoom) / (FACE_START - FACE_END), 0, 1), ft = ft0 * ft0 * (3 - 2 * ft0); // 0 normal view, 1 face close-up
      const headX = eye.x - nose.x, headY = eye.y - nose.y; // the middle of the head (under the hands while hanging)
      const tx = (camMode === 'side' ? r.x + (st.phoneWatch ? 0.5 : 5) : r.x + 4) * (1 - ft) + headX * ft, wantY = camMode === 'side' ? r.y + 2.5 : r.y + 1.5;
      camY = !camYSet || Math.abs(wantY - camY) > 4 ? wantY : camY + (wantY - camY) * (1 - Math.exp(-dtHead / 0.15)); camYSet = true; // a retry or a big drop snaps; a dip eases
      const ty = camY * (1 - ft) + headY * ft;
      const len = off.length() * Math.max(orbit.zoom, FACE_START) * (1 - ft) + FACE_DIST * ft;
      const yaw = Math.atan2(off.x, off.z) + orbit.yaw + facing * 1.05 * ft; // swing round to the front of the face
      const pitch = clamp(Math.asin(off.y / off.length()) + orbit.pitch, 0.03, 1.35) * (1 - ft) + 0.08 * ft;
      const want = new THREE.Vector3(tx + len * Math.cos(pitch) * Math.sin(yaw), Math.max(0.5, ty + len * Math.sin(pitch)), len * Math.cos(pitch) * Math.cos(yaw));
      camPos.lerp(want, 0.12);
      camera.position.copy(camPos);
      camera.lookAt(tx, ty, 0);
      document.documentElement.dataset.camdist = camPos.distanceTo(new THREE.Vector3(tx, ty, 0)).toFixed(2); // for the face-zoom check
    }
    if (film) { // ?film=<shot> (CC-130): the film camera takes over the view; play is unchanged without it
      filmAir += ((r.grounded ? 0 : 1) - filmAir) * (1 - Math.exp(-dtHead / 0.25));
      const p = film.pose({ runnerX: r.x, runnerY: r.y, airborne: filmAir });
      if (filmShot === 'clean') { film.tick(camera); } else {
      if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
      camera.up.set(0, 1, 0); camera.position.set(...p.pos); camera.lookAt(...p.look); camPos.copy(camera.position);
      if (p.hideBody) { if (actor) actor.object.visible = false; body.visible = false; } // the eyes shot ends inside the head, as the First person camera does
      film.tick(camera);
      if (filmShot === 'eyesC' && p.fov > 60) { if (actor) actor.object.visible = false; body.visible = false; }
      }
    }
  }

  function drawFront(): void {
    const facing = deps.facing(), actor = deps.actor(), r = st.world.runner;
    // The front inset accompanies the default side view; F toggles it in every camera mode.
    const showFront = st.frontOverride ?? true;
    pipFrame.style.display = showFront ? 'block' : 'none';
    if (showFront) {
      // On a coaster the inset rides with the cart and looks forward along its rails; elsewhere it shows the runner's eyes.
      if (course.track && st.world.mode === 'cart' && st.world.cart) {
        const direction = st.world.cart.v < -0.3 ? -1 : 1;
        const rails = railsOf(course.track, st.world.cart?.segment ?? 0), aheadX = r.x + direction * 12;
        frontCam.up.set(0, 1, 0);
        frontCam.position.set(r.x, r.y + 1.4, 0);
        frontCam.lookAt(aheadX, rails.y(aheadX) + 1.4, 0);
      } else {
        // First person: the eyes, looking the way the body faces and a little down, turned with the body about the bar.
        const fwd = new THREE.Vector3(facing * Math.cos(0.1), -Math.sin(0.1), 0).applyQuaternion(qRoll);
        frontCam.up.set(0, 1, 0).applyQuaternion(qRoll);
        frontCam.position.set(eye.x, eye.y, 0.1); frontCam.lookAt(eye.x + 10 * fwd.x, eye.y + 10 * fwd.y, 0.1);
      }
      const actorWasVisible = actor?.object.visible ?? false;
      if (actor) actor.object.visible = false; // no body in front of the eyes
      const W = host.clientWidth, H = host.clientHeight;
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      const py = H - PIP_BOTTOM - PIP_H; // the WebGPU viewport counts from the top
      renderer.setViewport(W - PIP_W - 16, py, PIP_W, PIP_H); renderer.setScissor(W - PIP_W - 16, py, PIP_W, PIP_H);
      renderer.render(scene, frontCam);
      if (actor) actor.object.visible = actorWasVisible;
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.autoClear = true;
    }
  }

  return { camera, frontCam, button: camBtn, filmShot, mode: () => camMode, orbit, pipFrame, nextCam, update, drawFront };
}
