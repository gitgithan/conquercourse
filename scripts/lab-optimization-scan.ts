import { readFileSync, writeFileSync } from "node:fs";
import type { CourseData } from "../src/course/course";
import { PROBLEMS, encode, sampleAt, type Table } from "../src/labs/optimization/core";

// Plays the real simulator at every cell of each Lab 2 map and saves the result, so the map shows at once and a test can check the live runs against it.
// Run: npx tsx scripts/lab-optimization-scan.ts   (about 15 s)
for (const p of PROBLEMS) {
  const course = JSON.parse(readFileSync("public" + p.courseUrl, "utf8")) as CourseData;
  const [ax, ay] = p.axes;
  const t: Table = { id: p.id, nx: ax.count, ny: ay.count, cells: [] };
  for (let j = 0; j < ay.count; j++) for (let i = 0; i < ax.count; i++) t.cells.push(encode(sampleAt(p, course, i, j)));
  writeFileSync(`public/assets/lab/opt-${p.id}.table.json`, JSON.stringify(t, null, 2) + "\n");
  console.log(p.id, t.cells.length, "cells,", t.cells.filter((v) => v > 0).length, "clear");
}
