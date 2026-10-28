import * as THREE from 'three';
import { CUP, patternOf, stackCups, STACK_PREFIX } from './stack';

// The cups of a stack, drawn: one instanced cone per cup (mouth down), a colour per row like the plastic sets (no logos).
// In cup metres, standing on y = 0 and centred; the caller scales it to the piece or scene item.
const ROW_COLOURS = [0xe03a3e, 0xf2c230, 0x2f6fd0, 0x3aa655, 0x8a4fd0];
let geometry: THREE.CylinderGeometry | null = null;

export function cupsGroup(src: string): THREE.Group {
  const g = new THREE.Group();
  const pattern = patternOf(src.startsWith(STACK_PREFIX) ? src : STACK_PREFIX + src);
  if (!pattern) return g;
  const { cups, length } = stackCups(pattern);
  geometry ??= new THREE.CylinderGeometry(CUP.top / 2, CUP.mouth / 2, CUP.h, 20, 1, false); // narrow end up
  const inst = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }), cups.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cups.forEach((cup, i) => {
    m.makeTranslation(cup.x - length / 2, cup.y + CUP.h / 2, cup.z);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.setHex(ROW_COLOURS[cup.row % ROW_COLOURS.length]));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);
  return g;
}
