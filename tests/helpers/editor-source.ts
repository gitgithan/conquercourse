import { readdirSync, readFileSync } from 'node:fs';

// The text of the World editor code: src/modes/editor.ts plus every file under src/modes/editor/ (sorted by name), so source-reading tests keep working when the code is split.
export function editorSource(): string {
  const read = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((f) => f.isDirectory() ? read(`${dir}/${f.name}`) : f.name.endsWith('.ts') ? [readFileSync(`${dir}/${f.name}`, 'utf8')] : []);
  let parts: string[] = [];
  try { parts = read('src/modes/editor'); } catch { /* not split yet */ }
  return [readFileSync('src/modes/editor.ts', 'utf8'), ...parts].join('\n');
}
