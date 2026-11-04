import { describe, expect, it } from 'vitest';
import { applyH, facadeAspect, facadeOn, homography, pickWall, rectifyMap, wallQuad, FACADES, type Quad } from '../src/world/facade';

const near = (a: number[], b: number[], eps = 1e-6) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps));

describe('homography', () => {
  it('sends each of the four corners to its target', () => {
    const from: Quad = [[10, 20], [310, 35], [300, 260], [5, 240]], to: Quad = [[0, 0], [100, 0], [100, 80], [0, 80]];
    const H = homography(from, to);
    from.forEach((p, i) => near(applyH(H, p), to[i]));
  });
  it('is the identity for the same square', () => {
    const q: Quad = [[0, 0], [4, 0], [4, 3], [0, 3]];
    near(homography(q, q), [1, 0, 0, 0, 1, 0, 0, 0]);
  });
  it('keeps straight lines straight (the middle of an edge stays on that edge)', () => {
    const photo: Quad = [[100, 50], [900, 80], [880, 700], [120, 650]], map = rectifyMap(photo, 200, 100);
    const [x, y] = map(100, 0); // the middle of the top edge of the picture
    const t = (x - 100) / 800;
    expect(Math.abs(y - (50 + 30 * t))).toBeLessThan(1e-6);
  });
  it('the picture corners come from the photo corners', () => {
    const photo: Quad = [[100, 50], [900, 80], [880, 700], [120, 650]], map = rectifyMap(photo, 200, 100);
    near(map(0, 0), photo[0]); near(map(200, 0), photo[1]); near(map(200, 100), photo[2]); near(map(0, 100), photo[3]);
  });
  it('refuses four corners on one line', () => {
    expect(() => homography([[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]])).toThrow();
  });
  it('reads the proportions of a crop', () => {
    expect(facadeAspect([[0, 0], [300, 0], [300, 200], [0, 200]])).toBeCloseTo(1.5, 6);
  });
});

describe('picking the wall', () => {
  // x east, z south; a 30 m (east-west) by 10 m (north-south) building
  const ring = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 10 }, { x: 0, z: 10 }];
  it('finds the south wall (facing 180) by direction and width', () => {
    const w = pickWall(ring, 30, 180); expect(w?.i).toBe(2); expect(w?.length).toBeCloseTo(30);
  });
  it('finds the north wall (facing 0) and the east wall (facing 90), whichever way the ring runs', () => {
    expect(pickWall(ring, 30, 0)?.i).toBe(0);
    expect(pickWall([...ring].reverse(), 10, 90)?.length).toBeCloseTo(10);
  });
  it('refuses a wall of the wrong width', () => { expect(pickWall(ring, 18, 180)).toBeNull(); });
  it('finds the library portico in the real footprint of the Bryant Park scenery', async () => {
    const { readFileSync } = await import('node:fs');
    const osm = JSON.parse(readFileSync('public/assets/places/skin/bryant-park-new-york-osm.json', 'utf8'));
    const f = FACADES[0], e = osm.elements.find((x: { tags?: { name?: string } }) => x.tags?.name === f.building);
    const mLon = 111320 * Math.cos((osm.lat * Math.PI) / 180);
    const ring = e.geometry.slice(0, -1).map((p: { lat: number; lon: number }) => ({ x: (p.lon - osm.lon) * mLon, z: -(p.lat - osm.lat) * 111320 }));
    const w = pickWall(ring, f.width, f.facing);
    expect(w).not.toBeNull(); expect(Math.abs(w!.length - f.width)).toBeLessThan(0.7);
    expect(f.aspect).toBeGreaterThan(1.3); expect(f.aspect).toBeLessThan(1.5);
  });
});

describe('the quad on the wall', () => {
  it('stands on the wall, faces out, and reads left to right from outside', () => {
    // south wall of the 30 x 10 building, seen from the south: east is the viewer's right
    const q = wallQuad({ x: 30, z: 10 }, { x: 0, z: 10 }, [0, 1], 12, { lift: 0 });
    const p = q.positions;
    expect(p.slice(0, 3)).toEqual([0, 0, 10]); // the left bottom corner is the west end
    expect(p.slice(3, 6)).toEqual([30, 0, 10]);
    expect(p.slice(6, 9)).toEqual([30, 12, 10]);
    expect(q.uvs).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
    // the first triangle's normal points out (+z)
    const [ax, ay, az] = p.slice(0, 3), [bx, by, bz] = p.slice(3, 6), [cx, cy, cz] = p.slice(6, 9);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    expect(nz).toBeGreaterThan(0); void az; void bz; void cz;
  });
  it('is lifted off the wall by a few centimetres and scales with k', () => {
    const q = wallQuad({ x: 0, z: 0 }, { x: 10, z: 0 }, [0, -1], 5, { lift: 0.04, k: 0.5 });
    expect(q.positions[2]).toBeCloseTo(-0.02, 6); expect(q.positions[7]).toBeCloseTo(2.5, 6);
  });
});

describe('the switch', () => {
  it('is on at localhost and the preview site, off on production, and the address forces it', () => {
    expect(facadeOn(null, 'localhost')).toBe(true);
    expect(facadeOn(null, 'preview.conquercourse.pages.dev')).toBe(true);
    expect(facadeOn(null, 'conquercourse.pages.dev')).toBe(false);
    expect(facadeOn('1', 'conquercourse.pages.dev')).toBe(true);
    expect(facadeOn('0', 'localhost')).toBe(false);
  });
});

describe('in the scenery', async () => {
  const THREE = await import('three');
  const { buildSkin } = await import('../src/world/skin');
  const { readFileSync } = await import('node:fs');
  const osm = JSON.parse(readFileSync('public/assets/places/skin/bryant-park-new-york-osm.json', 'utf8'));
  const names = (g: import('three').Group) => { const n: string[] = []; g.traverse((o) => { if (o.name === 'facade') n.push(o.name); }); return n; };
  it('off: no facade mesh and the same buildings; on: exactly one facade mesh, the prism only taller', () => {
    const off = buildSkin(osm, { skin: 'tags', noLand: true });
    const on = buildSkin(osm, { skin: 'tags', noLand: true, facades: [{ spec: FACADES[0], texture: new THREE.Texture() }] });
    expect(names(off.group)).toHaveLength(0); expect(names(on.group)).toHaveLength(1);
    expect(on.stats.buildings).toBe(off.stats.buildings); expect(on.stats.facades).toBe(1);
    const box = (g: import('three').Group) => new THREE.Box3().setFromObject(g);
    expect(box(on.group).min.x).toBeCloseTo(box(off.group).min.x, 6);
  });
});
