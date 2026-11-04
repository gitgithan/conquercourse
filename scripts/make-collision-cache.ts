// Builds public/assets/demo/collision-stages.default.json: the Collision Lab's stages for the default voxel size, recorded once so the page shows at once.
// Run: npx tsx scripts/make-collision-cache.ts   (tests/collision-cache.test.ts fails if this file no longer equals a fresh run)
import { readFileSync, writeFileSync } from 'node:fs';
import { readGlbMesh } from '../src/slice/glb';
import { DEFAULT_VOXEL } from '../src/labs/collision/collision-core';
import { packView, runView } from '../src/labs/collision/stages-view';

const buf = readFileSync('public/assets/objects/monkey-bars-saienji-cc0.glb');
const mesh = readGlbMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
writeFileSync('public/assets/demo/collision-stages.default.json', JSON.stringify(packView(runView(mesh, DEFAULT_VOXEL)), null, 2) + '\n');
console.log('written');
