// ?demo=captured-vault: preview captured vaults and height-retarget experiments without changing gameplay.
import * as THREE from 'three/webgpu';
import { parseClip, sampleClip, type Clip } from '../motion/clip';
import { ik2 } from '../motion/compose';
import { clipToWorld } from '../motion/pose';
import { legLength } from '../motion/timeline';
import { createStage } from '../render/scene';
import { loadRookie, type PosedRookie } from '../render/rookie';

const CLIMB_URL = '/data/eval/motion-vault/outputs/london_parkour_ledge_landing_35_37/clip.json';
const VAULT_URL = '/data/eval/motion-vault/outputs/london_parkour_same_level_vault_80_84/clip.json';
const RUN_URL = '/assets/motion/run.json';
const LAND_URL = '/assets/motion/land.json';
const CLIMB_HEIGHT = 1.35;
const WALL_START = 3.55;
const WALL_THICKNESS = 0.25;
const WALL_SPAN = 2.2;
const LANDING_LEDGE_LENGTH = 3;
const LANDING_LEDGE_THICKNESS = 0.2;
const LONG_BLOCK = 6;
const RUN_ON_SECONDS = 1.5;
const BRIDGE_FRAMES = 12;
const RUN_AFTER_LANDING_SECONDS = 0.9;
const HIGH_WALL_TEST = CLIMB_HEIGHT * 1.5;

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function mixFrame(a: number[][], b: number[][], weight: number): number[][] {
  return a.map((joint, i) => joint.map((v, axis) => v + (b[i][axis] - v) * weight));
}

function ledgeHandWeight(progress: number, timeOffset = 0): number {
  const t = progress + timeOffset;
  return smoothstep(1.05, 1.2, t) * (1 - smoothstep(1.55, 1.82, t));
}

function vaultHandWeight(progress: number): number {
  return smoothstep(1.02, 1.2, progress) * (1 - smoothstep(1.62, 1.82, progress));
}

function reachHandsToLedge(joints: THREE.Vector3[], clip: Clip, rookie: PosedRookie, scale: number, height: number, weight: number, onTop: boolean): void {
  if (weight <= 0) return;
  const ix = (name: string) => clip.names.indexOf(name);
  for (const side of ['Left', 'Right'] as const) {
    const shoulder = ix(side + 'Arm');
    const elbow = ix(side + 'ForeArm');
    const hand = ix(side + 'Hand');
    const upper = rookie.rig.bones[shoulder].restPos.distanceTo(rookie.rig.bones[elbow].restPos);
    const forearm = rookie.rig.bones[elbow].restPos.distanceTo(rookie.rig.bones[hand].restPos);
    const edgeX = onTop ? (WALL_START + 0.12) * scale : (WALL_START - 0.18) * scale;
    const target = new THREE.Vector3(edgeX, height * scale + 0.025 * scale, (side === 'Left' ? -0.18 : 0.18) * scale);
    const reached = ik2(joints[shoulder], target, upper, forearm, new THREE.Vector3(0, -0.25, side === 'Left' ? -1 : 1));
    const delta = reached.hand.clone().sub(joints[hand]).multiplyScalar(weight);
    joints[elbow].lerp(reached.elbow, weight);
    joints[hand].add(delta);
    for (const name of ['HandThumbEnd', 'HandMiddleEnd']) joints[ix(side + name)].add(delta);
  }
}

function kickFootWeight(progress: number, height: number, force = false, timeOffset = 0): number {
  const highWall = force ? 1 : smoothstep(CLIMB_HEIGHT, HIGH_WALL_TEST, height);
  const t = progress + timeOffset;
  return smoothstep(1.02, 1.12, t) * (1 - smoothstep(1.38, 1.58, t)) * highWall;
}

function kickOffWall(joints: THREE.Vector3[], clip: Clip, rookie: PosedRookie, scale: number, height: number, weight: number): void {
  if (weight <= 0) return;
  const ix = (name: string) => clip.names.indexOf(name);
  const hip = ix('RightLeg');
  const knee = ix('RightShin');
  const foot = ix('RightFoot');
  const upper = rookie.rig.bones[hip].restPos.distanceTo(rookie.rig.bones[knee].restPos);
  const lower = rookie.rig.bones[knee].restPos.distanceTo(rookie.rig.bones[foot].restPos);
  const kickHeight = (0.6 + Math.max(0, height - CLIMB_HEIGHT) * 0.7) * scale;
  const target = new THREE.Vector3((WALL_START - 0.06) * scale, kickHeight, 0.12 * scale);
  const reached = ik2(joints[hip], target, upper, lower, new THREE.Vector3(-0.3, 0, 1));
  const delta = reached.hand.clone().sub(joints[foot]).multiplyScalar(weight);
  joints[knee].lerp(reached.elbow, weight);
  joints[foot].add(delta);
  joints[ix('RightToeBase')].add(delta);
}

function placeBoneAtWorld(rookie: PosedRookie, index: number, target: THREE.Vector3, weight: number): void {
  if (weight <= 0) return;
  const bone = rookie.bones[index];
  const parent = bone.parent;
  if (!parent) return;
  const actual = bone.getWorldPosition(new THREE.Vector3()).lerp(target, weight);
  parent.updateWorldMatrix(true, false);
  bone.position.copy(parent.worldToLocal(actual));
  rookie.object.updateMatrixWorld(true);
}

function climbAndRun(climb: Clip, run: Clip, height: number): number[][][] {
  const delta = height - CLIMB_HEIGHT;
  const climbed = climb.frames.map((frame, i) => {
    const phase = i / climb.fps;
    const lift = smoothstep(height > CLIMB_HEIGHT ? 1.12 : 0.82, height > CLIMB_HEIGHT ? 1.62 : 1.82, phase) * delta;
    return frame.map(([x, y, z]) => [x, y + lift, z]);
  });
  const last = climbed[climbed.length - 1];
  const firstRunRoot = run.frames[0][0];
  const endRoot = last[0];
  const feet = run.names.map((name, i) => (/Foot$|ToeBase$/.test(name) ? i : -1)).filter((i) => i >= 0);
  const runFloor = Math.min(...run.frames.flatMap((pose) => feet.map((i) => pose[i][1])));
  const runFloorOffset = height - runFloor;
  const loopDuration = (run.frames.length - 1) / run.fps;
  const loopTravel = run.frames[run.frames.length - 1][0][2] - firstRunRoot[2];
  const runCount = Math.round(RUN_ON_SECONDS * climb.fps);
  for (let i = 1; i <= runCount; i++) {
    const seconds = i / climb.fps;
    const laps = Math.floor(seconds / loopDuration);
    const raw = sampleClip(run, seconds - laps * loopDuration, false)
      .map(([x, y, z]) => [x, y, z + laps * loopTravel]);
    const aligned = raw.map((joint) => [
      joint[0] + endRoot[0] - firstRunRoot[0],
      joint[1] + runFloorOffset,
      joint[2] + endRoot[2] - firstRunRoot[2],
    ]);
    const blend = i <= BRIDGE_FRAMES ? smoothstep(0, BRIDGE_FRAMES, i) : 1;
    climbed.push(i <= BRIDGE_FRAMES ? mixFrame(last, aligned, blend) : aligned);
  }
  return climbed;
}

function climbWithKick(climb: Clip, vault: Clip, run: Clip, height: number, kickEndFrame: number): number[][][] {
  const pullUpFrame = Math.min(48, climb.frames.length - 1);
  const heightDelta = height - CLIMB_HEIGHT;

  // 1. Kick phase: run-up and foot plant on the wall face (from the vault clip)
  const kickEnd = Math.min(kickEndFrame, vault.frames.length - 1);
  const kick = vault.frames.slice(0, kickEnd + 1).map((frame, i) => {
    const phase = i / vault.fps;
    const lift = smoothstep(0.82, 1.82, phase) * heightDelta;
    return frame.map(([x, y, z]) => [x, y + lift, z]);
  });

  // 2. Pull-up phase: from the climb clip, starting at the pull-up frame
  const pullUp = climb.frames.slice(pullUpFrame).map((frame) => {
    return frame.map(([x, y, z]) => [x, y + heightDelta, z]);
  });

  // 3. Root-align the pull-up to the end of the kick
  const kickRoot = kick[kick.length - 1][0];
  const pullUpRoot = pullUp[0][0];
  const dx = kickRoot[0] - pullUpRoot[0];
  const dz = kickRoot[2] - pullUpRoot[2];
  const alignedPullUp = pullUp.map((frame) =>
    frame.map(([x, y, z]) => [x + dx, y, z + dz])
  );

  // 4. Blend the last few kick frames into the first few pull-up frames
  const blendFrames = 6;
  const out = [...kick];
  for (let i = 0; i < alignedPullUp.length; i++) {
    if (i < blendFrames) {
      const weight = smoothstep(0, blendFrames, i);
      const kickIdx = kick.length - blendFrames + i;
      const blended = mixFrame(kick[kickIdx], alignedPullUp[i], weight);
      out.push(blended);
    } else {
      out.push(alignedPullUp[i]);
    }
  }

  // 5. Run along the top of the wall (same recipe as climbAndRun)
  const last = out[out.length - 1];
  const firstRunRoot = run.frames[0][0];
  const endRoot = last[0];
  const feet = run.names.map((name, i) => (/Foot$|ToeBase$/.test(name) ? i : -1)).filter((i) => i >= 0);
  const runFloor = Math.min(...run.frames.flatMap((pose) => feet.map((i) => pose[i][1])));
  const runFloorOffset = height - runFloor;
  const loopDuration = (run.frames.length - 1) / run.fps;
  const loopTravel = run.frames[run.frames.length - 1][0][2] - firstRunRoot[2];
  const runCount = Math.round(RUN_ON_SECONDS * climb.fps);
  for (let i = 1; i <= runCount; i++) {
    const seconds = i / climb.fps;
    const laps = Math.floor(seconds / loopDuration);
    const raw = sampleClip(run, seconds - laps * loopDuration, false)
      .map(([x, y, z]) => [x, y, z + laps * loopTravel]);
    const aligned = raw.map((joint) => [
      joint[0] + endRoot[0] - firstRunRoot[0],
      joint[1] + runFloorOffset,
      joint[2] + endRoot[2] - firstRunRoot[2],
    ]);
    const blend = i <= BRIDGE_FRAMES ? smoothstep(0, BRIDGE_FRAMES, i) : 1;
    out.push(i <= BRIDGE_FRAMES ? mixFrame(last, aligned, blend) : aligned);
  }

  return out;
}

function runAfterLanding(landed: number[][][], run: Clip, fps: number, floorHeight = 0): number[][][] {
  const endRoot = landed[landed.length - 1][0];
  const landPose = landed[landed.length - 1];
  const firstRunRoot = run.frames[0][0];
  const feet = run.names.map((name, i) => (/Foot$|ToeBase$/.test(name) ? i : -1)).filter((i) => i >= 0);
  const runFloor = Math.min(...run.frames.flatMap((pose) => feet.map((i) => pose[i][1])));
  const loopDuration = (run.frames.length - 1) / run.fps;
  const loopTravel = run.frames[run.frames.length - 1][0][2] - firstRunRoot[2];
  const count = Math.round(RUN_AFTER_LANDING_SECONDS * fps);
  for (let i = 1; i <= count; i++) {
    const seconds = i / fps;
    const laps = Math.floor(seconds / loopDuration);
    const raw = sampleClip(run, seconds - laps * loopDuration, false)
      .map(([x, y, z]) => [x, y, z + laps * loopTravel]);
    const aligned = raw.map((joint) => [
      joint[0] + endRoot[0] - firstRunRoot[0],
      joint[1] - runFloor + floorHeight,
      joint[2] + endRoot[2] - firstRunRoot[2],
    ]);
    const blend = i <= BRIDGE_FRAMES ? smoothstep(0, BRIDGE_FRAMES, i) : 1;
    landed.push(i <= BRIDGE_FRAMES ? mixFrame(landPose, aligned, blend) : aligned);
  }
  return landed;
}

function ledgeKickThenVault(climb: Clip, vault: Clip, land: Clip, run: Clip, height: number, landingHeight = 0): number[][][] {
  const pullUpFrame = Math.min(48, climb.frames.length - 1);
  const heightDelta = height - CLIMB_HEIGHT;
  const ledgeApproach = climb.frames.slice(0, pullUpFrame + 1).map((frame, i) => {
    const phase = i / climb.fps;
    const lift = smoothstep(height > CLIMB_HEIGHT ? 1.12 : 0.82, height > CLIMB_HEIGHT ? 1.62 : 1.82, phase) * heightDelta;
    return frame.map(([x, y, z]) => [x, y + lift, z]);
  });

  // Branch before the ledge clip settles into its squat. Align the captured
  // vault's airborne pass to the end of the shared kick and pull-up.
  const vaultStart = Math.min(40, vault.frames.length - 1);
  const vaultEnd = Math.min(60, vault.frames.length - 1);
  const ledgeEnd = ledgeApproach[ledgeApproach.length - 1][0];
  const vaultRoot = vault.frames[vaultStart][0];
  const out = [...ledgeApproach];
  // Carry the captured body pose over the edge, but replace the uneven
  // captured vertical settling with a continuous ballistic fall to the far side.
  const landEndY = land.frames[land.frames.length - 1][0][1] + landingHeight;
  const fallStartY = ledgeEnd[1];
  const drop = Math.max(0.05, fallStartY - landEndY);
  const fallDuration = Math.sqrt((2 * drop) / 9.81);
  const fallCount = Math.max(1, Math.round(fallDuration * vault.fps));
  const poseBlendFrames = Math.min(6, fallCount);
  for (let i = 1; i <= fallCount; i++) {
    const progress = i / fallCount;
    const sourceFrame = vaultStart + progress * (vaultEnd - vaultStart);
    const sourceIndex = Math.floor(sourceFrame);
    const sourceMix = sourceFrame - sourceIndex;
    const captured = mixFrame(vault.frames[sourceIndex], vault.frames[Math.min(sourceIndex + 1, vaultEnd)], sourceMix);
    const capturedRoot = captured[0];
    const rootX = capturedRoot[0] + ledgeEnd[0] - vaultRoot[0];
    const rootZ = capturedRoot[2] + ledgeEnd[2] - vaultRoot[2];
    const elapsed = progress * fallDuration;
    const rootY = fallStartY - 0.5 * 9.81 * elapsed * elapsed;
    const airborne = captured.map(([x, y, z]) => [
      x + ledgeEnd[0] - vaultRoot[0],
      y + rootY - capturedRoot[1],
      z + ledgeEnd[2] - vaultRoot[2],
    ]);
    if (i <= poseBlendFrames) {
      const weight = smoothstep(0, poseBlendFrames, i);
      const blended = mixFrame(ledgeApproach[ledgeApproach.length - 1], airborne, weight);
      const delta = [rootX - blended[0][0], rootY - blended[0][1], rootZ - blended[0][2]];
      out.push(blended.map(([x, y, z]) => [x + delta[0], y + delta[1], z + delta[2]]));
    } else {
      out.push(airborne);
    }
  }
  return runAfterLanding(out, run, vault.fps, landingHeight);
}

export async function startCapturedVaultDemo(): Promise<void> {
  const stage = await createStage(document.body, false);
  const { scene, camera } = stage;
  scene.background = new THREE.Color(0xbfdcf2);
  scene.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry).forEach((o) => (o.visible = false));

  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x8a9a5b }));
  floor.position.set(4, -0.06, 0);
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ color: 0x75604c, roughness: 0.82 }));
  scene.add(wall);
  const landingLedge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ color: 0x6f8c74, roughness: 0.86 }));
  landingLedge.visible = false;
  scene.add(landingLedge);

  const [climbRes, vaultRes, runRes, landRes] = await Promise.all([fetch(CLIMB_URL), fetch(VAULT_URL), fetch(RUN_URL), fetch(LAND_URL)]);
  if (!climbRes.ok || !vaultRes.ok || !runRes.ok || !landRes.ok) {
    throw new Error('Captured motion preview needs the local repo data files and public run/land clips.');
  }
  const climb = parseClip(await climbRes.json());
  const vault = parseClip(await vaultRes.json());
  const run = parseClip(await runRes.json());
  const land = parseClip(await landRes.json());
  const rookie: PosedRookie = await loadRookie('a', climb.names, climb.parents);
  scene.add(rookie.object);
  const restLocal = new Map<number, THREE.Vector3>();
  for (const name of ['LeftHand', 'RightHand', 'RightFoot']) {
    const index = climb.names.indexOf(name);
    restLocal.set(index, rookie.bones[index].position.clone());
  }

  const card = document.createElement('section');
  card.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2;display:grid;gap:8px;width:min(440px,calc(100vw - 48px));padding:12px 14px;background:#fffffff2;border:1px solid #17201d;border-radius:10px;color:#17201d;font:14px system-ui,sans-serif;box-shadow:0 3px 16px #0003';
  const heading = document.createElement('strong');
  heading.textContent = 'Captured vault test clips';
  const select = document.createElement('select');
  select.add(new Option('Climb onto a long ledge, then run along it', 'climb-run'));
  select.add(new Option('Climb: full kick then pull up', 'climb-kick-full'));
  select.add(new Option('Climb: short kick then pull up', 'climb-kick-short'));
  select.add(new Option('Kick, vault over wall, then fall and land', 'height-blend'));
  select.add(new Option('Vault over wall, drop to a lower ledge, then run', 'wall-drop-ledge'));
  select.style.cssText = 'font:inherit;padding:7px';
  const heightLabel = document.createElement('label');
  heightLabel.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center';
  const heightText = document.createElement('span');
  heightText.textContent = 'Wall height';
  const heightValue = document.createElement('strong');
  const height = document.createElement('input');
  height.type = 'range';
  height.min = '0.4';
  height.max = '2.1';
  height.step = '0.025';
  height.value = String(CLIMB_HEIGHT);
  height.style.cssText = 'grid-column:1 / -1;width:100%';
  const highPreset = document.createElement('button');
  highPreset.type = 'button';
  highPreset.textContent = `Test 1.5× wall (${HIGH_WALL_TEST.toFixed(2)} m)`;
  highPreset.style.cssText = 'grid-column:1 / -1;justify-self:start;font:600 13px system-ui,sans-serif;padding:6px 10px;cursor:pointer';
  heightLabel.append(heightText, heightValue, height, highPreset);
  const landingHeightLabel = document.createElement('label');
  landingHeightLabel.style.cssText = 'display:none;grid-template-columns:1fr auto;gap:4px 10px;align-items:center';
  const landingHeightText = document.createElement('span');
  landingHeightText.textContent = 'Far ledge height';
  const landingHeightValue = document.createElement('strong');
  const landingHeight = document.createElement('input');
  landingHeight.type = 'range';
  landingHeight.min = '0';
  landingHeight.max = String(CLIMB_HEIGHT - 0.1);
  landingHeight.step = '0.025';
  landingHeight.value = '0.65';
  landingHeight.style.cssText = 'grid-column:1 / -1;width:100%';
  landingHeightLabel.append(landingHeightText, landingHeightValue, landingHeight);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  const play = document.createElement('button');
  play.textContent = 'Pause';
  const restart = document.createElement('button');
  restart.textContent = 'Restart';
  for (const button of [play, restart]) button.style.cssText = 'font:600 14px system-ui,sans-serif;padding:7px 12px;cursor:pointer';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.style.width = '100%';
  const time = document.createElement('div');
  time.style.cssText = 'font-variant-numeric:tabular-nums;color:#445';
  const note = document.createElement('div');
  note.style.cssText = 'color:#445;line-height:1.35';
  const cameraHint = document.createElement('div');
  cameraHint.textContent = 'Drag the scene to rotate around the character; use the wheel to zoom.';
  cameraHint.style.cssText = 'color:#445;line-height:1.35';
  row.append(play, restart);
  card.append(heading, select, heightLabel, landingHeightLabel, row, slider, time, note, cameraHint);
  document.body.append(card);

  let scale = 1;
  let fps = climb.fps;
  let frames: number[][][] = [];
  let frame = 0;
  let playing = true;
  let last = performance.now();
  // View the wall's broad face by default instead of looking along its edge.
  let orbitYaw = Math.PI / 2;
  let orbitPitch = 0.08;
  let orbitDistance = 12;
  const cameraTarget = new THREE.Vector3();
  const updateCamera = () => {
    const radius = orbitDistance * scale;
    const horizontal = Math.cos(orbitPitch) * radius;
    camera.position.set(
      cameraTarget.x + Math.sin(orbitYaw) * horizontal,
      cameraTarget.y + Math.sin(orbitPitch) * radius,
      cameraTarget.z + Math.cos(orbitYaw) * horizontal,
    );
    camera.lookAt(cameraTarget);
  };
  const canvas = stage.renderer.domElement;
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitYaw -= (event.clientX - lastPointerX) * 0.008;
    orbitPitch = clamp(orbitPitch + (event.clientY - lastPointerY) * 0.006, -0.45, 1.0);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    updateCamera();
  });
  const stopDragging = () => { dragging = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    orbitDistance = clamp(orbitDistance * Math.exp(event.deltaY * 0.001), 5, 28);
    updateCamera();
  }, { passive: false });
  const rebuild = () => {
    const h = Number(height.value);
    const isClimbKick = select.value === 'climb-kick-full' || select.value === 'climb-kick-short';
    const climbTest = select.value === 'climb-run' || isClimbKick;
    const lowerLedgeTest = select.value === 'wall-drop-ledge';
    const maxLandingHeight = Math.max(0, h - 0.1);
    landingHeight.max = String(maxLandingHeight);
    if (Number(landingHeight.value) > maxLandingHeight) landingHeight.value = String(maxLandingHeight);
    const landingY = lowerLedgeTest ? Number(landingHeight.value) : 0;
    landingHeightLabel.style.display = lowerLedgeTest ? 'grid' : 'none';
    landingHeightValue.textContent = `${landingY.toFixed(2)} m`;
    frames = select.value === 'climb-run'
      ? climbAndRun(climb, run, h)
      : isClimbKick
        ? climbWithKick(climb, vault, run, h, select.value === 'climb-kick-full' ? 40 : 24)
        : ledgeKickThenVault(climb, vault, land, run, h, landingY);
    const source = (climbTest || isClimbKick) ? climb : vault;
    const first = source.frames[0];
    const leg = legLength(source.names, (i) => new THREE.Vector3(...first[i]));
    scale = rookie.legLength / leg;
    fps = source.fps;
    frame = 0;
    playing = false;
    play.textContent = 'Play';
    heightValue.textContent = `${h.toFixed(2)} m`;
    slider.max = String(frames.length - 1);
    slider.value = '0';
    const length = climbTest ? LONG_BLOCK : WALL_THICKNESS;
    wall.scale.set(length * scale, h * scale, (climbTest ? 0.3 : WALL_SPAN / 4) * scale);
    wall.position.set((WALL_START + length / 2) * scale, h * scale / 2, 0);
    landingLedge.visible = lowerLedgeTest;
    if (lowerLedgeTest) {
      const ledgeStart = WALL_START + WALL_THICKNESS + 0.2;
      landingLedge.scale.set(LANDING_LEDGE_LENGTH * scale, LANDING_LEDGE_THICKNESS * scale, (WALL_SPAN / 4) * scale);
      landingLedge.position.set((ledgeStart + LANDING_LEDGE_LENGTH / 2) * scale, (landingY - LANDING_LEDGE_THICKNESS / 2) * scale, 0);
    }
    note.textContent = isClimbKick
      ? `${select.value === 'climb-kick-full' ? 'Full' : 'Short'} kick: the captured vault run-up kicks off the wall face, hands plant over the top, the captured pull-up takes the body up, then the runner continues along the ${LONG_BLOCK.toFixed(1)} m block.`
      : climbTest
      ? h > CLIMB_HEIGHT
        ? `High-wall test: the right foot kicks against the face while both hands reach the ${h.toFixed(2)} m top, then the runner continues along the ${LONG_BLOCK.toFixed(1)} m block.`
        : `The captured climb targets both hands at the block top during support, then continues into the game's run cycle on a ${LONG_BLOCK.toFixed(1)} m block.`
      : lowerLedgeTest
        ? `The wall vault continues onto a ${landingY.toFixed(2)} m lower ledge, lands, then runs along it.`
        : `Matches the ledge move through the arm pull-up, then carries the body over without squatting, falls to the far-side floor, and runs on.`;
    last = performance.now();
    showFrame();
  };
  const showFrame = () => {
    if (!frames.length) return;
    const i = Math.min(Math.max(Math.round(frame), 0), frames.length - 1);
    const joints = frames[i].map((p) => clipToWorld(p).multiplyScalar(scale));
    const isClimbKick = select.value === 'climb-kick-full' || select.value === 'climb-kick-short';
    const climbTest = select.value === 'climb-run' || isClimbKick;
    const lowerLedgeTest = select.value === 'wall-drop-ledge';
    const h = Number(height.value);
    const progress = i / fps;
    const vaultTest = !climbTest;
    const contactAction = climbTest || vaultTest;
    const handWeight = contactAction
      ? (vaultTest ? vaultHandWeight(progress) : ledgeHandWeight(progress))
      : 0;
    const footWeight = contactAction
      ? kickFootWeight(progress, h)
      : 0;
    const kickOnTop = isClimbKick;
    for (const [index, local] of restLocal) rookie.bones[index].position.copy(local);
    if (contactAction) {
      reachHandsToLedge(joints, climb, rookie, scale, h, handWeight, kickOnTop);
      kickOffWall(joints, climb, rookie, scale, h, footWeight);
    }
    rookie.apply(joints, { floor: false });
    if (contactAction && climbTest) {
      for (const side of ['Left', 'Right'] as const) {
        const index = climb.names.indexOf(side + 'Hand');
        const z = (side === 'Left' ? -0.18 : 0.18) * scale;
        const wristX = kickOnTop ? (WALL_START + 0.12) * scale : (WALL_START - 0.18) * scale;
        const fingertipX = kickOnTop ? (WALL_START + 0.28) * scale : WALL_START * scale;
        const wrist = new THREE.Vector3(wristX, h * scale + 0.025 * scale, z);
        const fingertips = new THREE.Vector3(fingertipX, h * scale, z);
        placeBoneAtWorld(rookie, index, wrist, handWeight);
        for (const endName of ['HandThumbEnd', 'HandMiddleEnd']) {
          placeBoneAtWorld(rookie, climb.names.indexOf(side + endName), fingertips, handWeight);
        }
      }
      const footIndex = climb.names.indexOf('RightFoot');
      const kickHeight = (0.6 + Math.max(0, h - CLIMB_HEIGHT) * 0.7) * scale;
      placeBoneAtWorld(rookie, footIndex, new THREE.Vector3((WALL_START - 0.06) * scale, kickHeight, 0.12 * scale), footWeight);
    }
    const length = climbTest ? LONG_BLOCK : WALL_THICKNESS;
    const centreX = lowerLedgeTest
      ? (WALL_START + WALL_THICKNESS + 0.2 + LANDING_LEDGE_LENGTH * 0.35)
      : (WALL_START + length / 2);
    const targetY = lowerLedgeTest ? (h + Number(landingHeight.value)) * 0.5 + 0.5 : h * 0.5 + 0.65;
    cameraTarget.set(centreX * scale, targetY * scale, 0);
    updateCamera();
    slider.value = String(i);
    time.textContent = `${(i / fps).toFixed(2)} s · frame ${i + 1} / ${frames.length}`;
  };
  select.onchange = rebuild;
  height.oninput = rebuild;
  landingHeight.oninput = rebuild;
  highPreset.onclick = () => { height.value = String(HIGH_WALL_TEST); rebuild(); };
  play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); };
  restart.onclick = () => { frame = 0; playing = true; play.textContent = 'Pause'; last = performance.now(); showFrame(); };
  slider.oninput = () => { frame = Number(slider.value); playing = false; play.textContent = 'Play'; showFrame(); };

  rebuild();
  stage.renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (playing) {
      frame += ((now - last) / 1000) * fps;
      if (frame >= frames.length - 1) { frame = frames.length - 1; playing = false; play.textContent = 'Play'; }
      showFrame();
    }
    last = now;
    stage.renderer.render(scene, camera);
  });
  document.documentElement.dataset.backend = stage.backend;
  document.documentElement.dataset.ready = 'true';
}
