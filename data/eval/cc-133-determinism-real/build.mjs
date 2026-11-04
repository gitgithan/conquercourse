// Builds dist/engine.js (one browser-ready script) and dist/courses.json (the shipped courses that carry a plan, plus those without).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).pathname;
mkdirSync(new URL('./dist/', import.meta.url).pathname, { recursive: true });
await build({ entryPoints: [new URL('./engine.ts', import.meta.url).pathname], bundle: true, format: 'iife', target: 'es2020', outfile: new URL('./dist/engine.js', import.meta.url).pathname, logLevel: 'warning' });
const src = readFileSync(root + 'src/course/demo-list.ts', 'utf8');
const files = [...src.matchAll(/'(public\/[^']+\.course\.json)'/g)].map((m) => m[1]).filter((f) => !f.endsWith('generated-1.course.json'));
const list = files.map((f) => ({ name: f.split('/').pop(), course: JSON.parse(readFileSync(root + f, 'utf8')) }));
writeFileSync(new URL('./dist/courses.json', import.meta.url).pathname, JSON.stringify(list));
console.log('built', files.length, 'courses');
