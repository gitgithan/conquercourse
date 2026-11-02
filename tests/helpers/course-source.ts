import { readdirSync, readFileSync } from 'node:fs';

// The text of the course page code: src/modes/course.ts plus every file in src/modes/course/ (sorted by name), so source-reading tests keep working when the code is split.
export function courseSource(): string {
  const dir = 'src/modes/course';
  let parts: string[] = [];
  try { parts = readdirSync(dir).filter((f) => f.endsWith('.ts')).sort().map((f) => readFileSync(`${dir}/${f}`, 'utf8')); } catch { /* not split yet */ }
  return [readFileSync('src/modes/course.ts', 'utf8'), ...parts].join('\n');
}
