// Writes a generated course: `npx tsx scripts/generate-course.ts <seed> [out.json] [--moves=gap,step,lache,wall,rope] [--length=4] [--difficulty=0.7]`
import { writeFileSync } from 'node:fs';
import { generateDetailed } from '../src/slice/generator';

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const pos = args.filter((a) => !a.startsWith('--'));
const seed = Number(pos[0] ?? 1);
const t0 = Date.now();
const g = generateDetailed(seed, {
  moves: flag('moves')?.split(','),
  length: flag('length') ? Number(flag('length')) : undefined,
  difficulty: flag('difficulty') ? Number(flag('difficulty')) : undefined,
});
const out = pos[1] ?? `test-results/generated-${seed}.course.json`;
writeFileSync(out, JSON.stringify(g.course, null, 2) + '\n');
console.log(`seed ${seed}: ${g.moves.map((m) => `${m.kind} ${m.size}`).join(', ')}; cleared ${g.cleared}; ${Date.now() - t0} ms; wrote ${out}`);
