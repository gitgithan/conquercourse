import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('worker and asset URLs written as new URL(path, import.meta.url)', () => {
  it('every relative path points at a file that exists (a moved module once broke the build)', () => {
    const bad: string[] = [];
    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/new URL\('(\.{1,2}\/[^']+)',\s*import\.meta\.url\)/g)) {
        if (!existsSync(resolve(dirname(file), m[1]))) bad.push(`${file}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
