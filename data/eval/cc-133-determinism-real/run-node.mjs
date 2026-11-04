// Runs the bundle in this Node and prints one JSON result: node run-node.mjs > out.json
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const d = new URL('./dist/', import.meta.url).pathname;
(0, eval)(readFileSync(d + 'engine.js', 'utf8'));
const { runAll, engineInfo } = globalThis.determinismReal;
const t = Date.now();
const runs = runAll(JSON.parse(readFileSync(d + 'courses.json', 'utf8')));
console.log(JSON.stringify({ machine: { engine: `node ${process.version} (V8 ${process.versions.v8})`, arch: process.arch, platform: process.platform, info: engineInfo(), seconds: (Date.now() - t) / 1000 }, runs }));
