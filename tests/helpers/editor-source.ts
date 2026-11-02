import { readdirSync, readFileSync } from 'node:fs';

// The text of the World editor code: src/modes/editor.ts plus every file in src/modes/editor/ (sorted by name), so source-reading tests keep working when the code is split.
export function editorSource(): string {
  const dir = 'src/modes/editor';
  let parts: string[] = [];
  try { parts = readdirSync(dir).filter((f) => f.endsWith('.ts')).sort().map((f) => readFileSync(`${dir}/${f}`, 'utf8')); } catch { /* not split yet */ }
  return [readFileSync('src/modes/editor.ts', 'utf8'), ...parts].join('\n');
}
