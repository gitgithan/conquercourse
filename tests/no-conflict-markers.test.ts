// CC-118: a merge or rebase conflict marker once reached main inside src/main.ts (commit f970f8c6, fixed by 1da7e67b).
// This test scans every tracked source, test, script and doc file for a marker at the start of a line.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const TEXT = /\.(ts|tsx|js|mjs|cjs|json|md|html|css|sh|py|yml|yaml)$/;
const START = /^(<{7}( |$)|>{7}( |$))/;

/** Opening and closing markers only: a line of "=======" under a heading is legal Markdown, so the middle line is not flagged. */
export function findMarkers(text: string): number[] {
  const lines = text.split('\n');
  const hits: number[] = [];
  lines.forEach((l, i) => { if (START.test(l)) hits.push(i + 1); });
  return hits;
}

describe('no conflict markers', () => {
  it('the finder sees an opening and a closing marker', () => {
    expect(findMarkers('a\n<<<<<<< HEAD\nb\n=======\nc\n>>>>>>> abc123\n')).toEqual([2, 6]);
    expect(findMarkers('a\nplain\n')).toEqual([]);
  });
  it('no tracked source, test, script or doc file holds a conflict marker', () => {
    const files = execFileSync('git', ['ls-files', '-z', '--', 'src', 'tests', 'scripts', 'docs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter((f) => f && TEXT.test(f) && existsSync(f));
    const bad: string[] = [];
    for (const f of files) {
      if (f === 'tests/no-conflict-markers.test.ts') continue;
      const hits = findMarkers(readFileSync(f, 'utf8'));
      if (hits.length) bad.push(`${f}:${hits.join(',')}`);
    }
    expect(bad, 'resolve the conflict and remove the marker lines').toEqual([]);
  });
});
