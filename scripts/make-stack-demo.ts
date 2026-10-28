// Writes the stack demo course through the same road as the editor: a stack piece, its lane, laneToCourse, sceneFor, then the proof.
// `npx tsx scripts/make-stack-demo.ts [pattern=3-6-3] [out=public/assets/demo/stack.course.json] [scale]`
import { writeFileSync } from 'node:fs';
import { searchIdealRun } from '../src/sim/ideal';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { sceneFor } from '../src/slice/scene';
import { patternOf, stackPiece, stackSrc } from '../src/slice/stack';
import { worldSamples } from '../src/slice/world';

const id = process.argv[2] ?? '3-6-3';
const out = process.argv[3] ?? 'public/assets/demo/stack.course.json';
const piece = stackPiece(stackSrc(id), { x: 0, z: 0 })!;
if (process.argv[4]) piece.scale = Number(process.argv[4]);
const lane = { angle: 0, offset: 0, level: 0 };
const pr = sliceProfile(worldSamples([piece]), { x: 0, z: 0 }, lane);
const course = laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, `Cup stacks: ${patternOf(piece.src)!.label}`);
const ps = course.terrain.platforms;
ps[0].x1 = ps[1].x0; // the start deck runs right up to the stack
ps[ps.length - 1].x0 = ps[ps.length - 2].x1; // and the finish deck starts where the stack ends
course.scene = sceneFor([piece], lane, course.uMap ?? []);
const x0 = ps[1].x0, x1 = ps[ps.length - 2].x1;
course.zones = [{ id: 'stack', name: 'Cup stacks', x0: x0 - 4, x1: x1 + 2 }];
course.checkpoints = [{ id: 'stack', x: x0 - 8 }];
course.finishX = Math.round((x1 + 5) * 100) / 100;
const res = searchIdealRun(course);
console.log(`${id} scale ${piece.scale}: cleared ${res.cleared}; platforms ${ps.length}; stack ${x0}..${x1}`);
if (res.cleared) course.plan = res.plan;
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
