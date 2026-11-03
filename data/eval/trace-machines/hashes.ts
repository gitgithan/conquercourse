// Node side: npx tsx data/eval/trace-machines/hashes.ts > hashes-nodeNN.txt
import { readFileSync } from "node:fs";
import type { CourseData } from "../../../src/course/course";
import { DEMO_COURSE_FILES } from "../../../src/course/demo-list";
import { hashLines } from "./hashlines";

const courses: Record<string, CourseData> = {};
for (const f of DEMO_COURSE_FILES.filter((f) => !f.endsWith("generated-1.course.json"))) courses[f.split("/").pop()!] = JSON.parse(readFileSync(f, "utf8"));
console.log(hashLines(courses).join("\n"));
