import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  DEFAULT_CAM, GAME_SIDE, IMG, JOINTS, LIMBS, altPose, focalPx, foreshortening, makeCamera, maxBoneChange, maxDepthGap, maxPixelGap,
  nearFarRatio, poseA, rayThroughPixel, toPx, vanishingPoint, segmentPx, PARENT,
} from "../src/labs/camera/camera-lab";

// camera and perspective: the pinhole camera laws, checked on the same three.js camera the game uses.
const front = (o = {}) => makeCamera({ ...DEFAULT_CAM, ...o, angle: 0 });
const side = (o = {}) => makeCamera({ ...DEFAULT_CAM, ...o, angle: 90 });

// joint i hangs below joint k in the body tree
const isBelow = (i: number, k: number): boolean => { for (let p = PARENT[i]; p >= 0; p = PARENT[p]) if (p === k) return true; return false; };

describe("Camera and perspective", () => {
  it("field of view gives the focal length: a point 1 m off-axis at depth d lands f/d pixels from the middle", () => {
    for (const fov of [20, 40, 75]) {
      const cam = makeCamera({ fov, height: 0.9, angle: 0, keepSize: true, dist: 6 });
      const d = cam.position.distanceTo(new THREE.Vector3(0, 0.9, 0));
      const p = toPx(cam, new THREE.Vector3(0, 0.9, 1));
      expect(Math.abs(p.x - IMG / 2)).toBeCloseTo(focalPx(fov) / d, 3);
      expect(p.y).toBeCloseTo(IMG / 2, 3);
    }
  });
  it("keeping the body the same size: the head-to-foot height on screen does not change with the lens", () => {
    const h = (fov: number) => { const c = makeCamera({ fov, height: 0.9, angle: 0, keepSize: true, dist: 6 }); return toPx(c, new THREE.Vector3(0, 0, 0)).y - toPx(c, new THREE.Vector3(0, 1.8, 0)).y; };
    expect(h(15)).toBeCloseTo(h(80), 0);
    expect(h(15)).toBeCloseTo(0.75 * IMG, 0);
  });
  it("a wider lens up close makes a near hand look bigger against the hips (dolly zoom)", () => {
    const pose = poseA();
    expect(nearFarRatio(front({ fov: 80 }), pose)).toBeGreaterThan(nearFarRatio(front({ fov: 15 }), pose));
  });
  it("the game's side camera (25 m back, lens 40) is nearly flat: depth barely changes the size", () => {
    const g = makeCamera(GAME_SIDE);
    expect(nearFarRatio(g, poseA())).toBeLessThan(1.1);
  });
  it("pixel to ray: the ray through a joint's pixel passes through the joint and through the other pose's joint", () => {
    const f = front(), a = poseA(), alt = altPose(a, f, LIMBS);
    a.forEach((p, i) => {
      const px = toPx(f, p), ray = rayThroughPixel(f, px.x, px.y);
      expect(ray.distanceToPoint(p)).toBeLessThan(1e-3);
      expect(ray.distanceToPoint(alt.pose[i])).toBeLessThan(1e-3);
    });
  });
  it("one photo cannot give depth: a different pose with the same bone lengths makes the same front picture", () => {
    const f = front(), a = poseA(), alt = altPose(a, f, ["armR", "legR", "armL"]);
    expect(alt.approx).toEqual([]);
    expect(maxPixelGap(f, a, alt.pose)).toBeLessThan(1e-3);
    expect(maxBoneChange(a, alt.pose)).toBeLessThan(1e-6);
    expect(maxDepthGap(a, alt.pose, f)).toBeGreaterThan(0.3); // metres of difference in depth
  });
  it("the second view reveals it, and a second view at a small angle reveals less", () => {
    const f = front(), a = poseA(), alt = altPose(a, f, ["armR", "legR"]).pose;
    const gap = (ang: number) => maxPixelGap(makeCamera({ ...DEFAULT_CAM, angle: ang }), a, alt);
    expect(gap(90)).toBeGreaterThan(40);
    expect(gap(90)).toBeGreaterThan(gap(30));
    expect(gap(5)).toBeLessThan(gap(30));
  });
  it("without a flip the second pose is the first", () => {
    const f = front(), a = poseA(), alt = altPose(a, f, []);
    expect(maxPixelGap(side(), a, alt.pose)).toBeLessThan(1e-9);
  });
  it("a flip is exact whenever it says so; where a bone is too short to reach the ray, those joints are named and the picture gap is only theirs", () => {
    let exact = 0;
    for (const fov of [10, 40, 90]) for (const height of [0.3, 1.2, 3]) {
      const f = front({ fov, height }), a = poseA(), alt = altPose(a, f, LIMBS);
      if (!alt.approx.length) { exact++; expect(maxPixelGap(f, a, alt.pose)).toBeLessThan(1e-3); }
      else {
        const ok = a.map((_, i) => i).filter((i) => !alt.approx.includes(i) && !alt.approx.some((k) => isBelow(i, k)));
        ok.forEach((i) => expect(Math.hypot(toPx(f, a[i]).x - toPx(f, alt.pose[i]).x, toPx(f, a[i]).y - toPx(f, alt.pose[i]).y)).toBeLessThan(1e-3));
      }
    }
    expect(exact).toBeGreaterThanOrEqual(5);
  });
  it("parallel lines meet at the vanishing point", () => {
    const cam = makeCamera({ ...DEFAULT_CAM, height: 2.5, angle: 60 }), d = new THREE.Vector3(1, 0, 0);
    const vp = vanishingPoint(cam, d)!;
    const far = (z: number): [number, number] => { const p = toPx(cam, new THREE.Vector3(-1e6, 0, z)); return [p.x, p.y]; };
    const [a1, a2] = [far(-2), far(3)];
    expect(a1[0]).toBeCloseTo(vp.x, 0); expect(a1[1]).toBeCloseTo(vp.y, 0);
    expect(a2[0]).toBeCloseTo(vp.x, 0); expect(a2[1]).toBeCloseTo(vp.y, 0);
  });
  it("a direction parallel to the picture plane has no vanishing point", () => {
    expect(vanishingPoint(front({ height: 0.9 }), new THREE.Vector3(0, 0, 1))).toBeNull();
  });
  it("foreshortening: the reaching arm shows less of its length from the front than from the side", () => {
    const a = poseA(), fa = foreshortening(front(), a).find((r) => r.name === "right forearm")!, sa = foreshortening(side(), a).find((r) => r.name === "right forearm")!;
    expect(fa.share).toBeLessThan(0.6);
    expect(sa.share).toBeGreaterThan(0.8);
  });
  it("segments behind the camera are cut, not drawn through it", () => {
    const f = front();
    expect(segmentPx(f, new THREE.Vector3(f.position.x + 5, 1, 0), new THREE.Vector3(f.position.x + 9, 1, 0))).toBeNull();
    const s = segmentPx(f, new THREE.Vector3(0, 1, 0), new THREE.Vector3(f.position.x + 9, 1, 0))!;
    expect(s[1].depth).toBeGreaterThan(0);
  });
  it("has all the joints the picture draws", () => { expect(poseA().length).toBe(JOINTS.length); });
});
