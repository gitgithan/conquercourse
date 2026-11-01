// CC-200: joins the per-place outputs of scripts/lane-equal-sweep.ts into run.json, scores.json and a markdown table.
// Usage: node scripts/lane-equal-aggregate.mjs <dir with the per-place json files> <out dir>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const [dir, out] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !['t.json'].includes(f)).sort();
const places = files.map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const per = places.map((p) => {
  const g = (on) => p.rows.filter((r) => r.roofStart === on);
  const sy = (on) => g(on).filter((r) => r.slicer).length;
  const rowsOn = g(true), rowsOff = g(false);
  const lost = rowsOff.filter((r, i) => r.slicer && !rowsOn[i]?.slicer).map((r) => r.cut);
  return { slug: p.slug, shrink: p.shrink, range: p.range, heights: rowsOff.length, slicerYesOff: sy(false), slicerYesOn: sy(true), disagree: p.disagree, courseDiffers: p.courseDiffers, replayFails: p.replayFails, lostWithRoofStart: lost, disagreements: p.rows.filter((r) => !r.agree || r.sameCourse === false || r.replayClears === false).map((r) => ({ cut: r.cut, roofStart: r.roofStart, slicer: r.slicer, editor: r.editor, sameCourse: r.sameCourse, replayClears: r.replayClears })) };
});
const sum = (k) => per.reduce((a, p) => a + p[k], 0);
const scores = { places: per.length, cases: places.reduce((a, p) => a + p.cases, 0), slicerYes: places.reduce((a, p) => a + p.slicerYes, 0), disagree: sum('disagree'), courseDiffers: sum('courseDiffers'), replayFails: sum('replayFails'), heightsSolvableOff: sum('slicerYesOff'), heightsSolvableOn: sum('slicerYesOn') };
writeFileSync(`${out}/scores.json`, JSON.stringify(scores, null, 2) + '\n');
writeFileSync(`${out}/run.json`, JSON.stringify({ script: 'scripts/lane-equal-sweep.ts', step: places[0]?.step, scores, places: per }, null, 2) + '\n');
const lines = ['| Place | Heights | Solvable roof start off | Solvable roof start on | Lost with roof start | Slicer vs editor disagree |', '| --- | --- | --- | --- | --- | --- |'];
for (const p of per) lines.push(`| ${p.slug} | ${p.heights} | ${p.slicerYesOff} | ${p.slicerYesOn} | ${p.lostWithRoofStart.length ? p.lostWithRoofStart.join(', ') + ' m' : 'none'} | ${p.disagree + p.courseDiffers + p.replayFails} |`);
writeFileSync(`${out}/table.md`, lines.join('\n') + '\n');
console.log(JSON.stringify(scores));
