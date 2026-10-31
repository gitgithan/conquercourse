// Measures which way each made character's skin faces against the way its bones face, before and after the load-time turn.
// usage: npx tsx data/eval/cc-chars-facing/scripts/measure.ts > data/eval/cc-chars-facing/facing.json
import { readFileSync } from 'node:fs';
import { faceForward, fitToSkeleton, measureFacing } from '../../../../src/characters/fit';
import { readSkin } from '../../../../src/characters/glb-skin';

const DIR = 'public/assets/characters/cast';
const cast = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')).items as { name: string; file: string }[];
const rows = cast.map((c) => {
  const bytes = () => new Uint8Array(readFileSync(`${DIR}/${c.file}`));
  const s = readSkin(bytes())!, m = measureFacing(s.positions, s.names, s.rest);
  const t = readSkin(bytes())!; faceForward(t);
  const turned = measureFacing(t.positions, t.names, t.rest);
  const f = readSkin(bytes())!, r = fitToSkeleton(f);
  const i = (n: string) => s.names.indexOf(n);
  const bone = ['Left', 'Right'].map((side) => { const a = s.rest[i(side + 'Foot')], b = s.rest[i(side + 'ToeBase')], d = Math.hypot(b[0] - a[0], b[2] - a[2]); return (b[2] - a[2]) / d; });
  // the run direction is the bones' forward (+z in the skin's frame, +x on screen); the dot is the shoe score's sign times that
  return {
    name: c.name,
    boneForwardDotRun: +Math.min(...bone).toFixed(3),
    scoreAsMade: +m.score.toFixed(3), verdictAsMade: m.verdict,
    scoreAfterTurn: +turned.score.toFixed(3), verdictAfterTurn: turned.verdict,
    turned: r.facing.turned,
  };
});
console.log(JSON.stringify({ rule: 'score = (front - back) / (front + back) of the shoe against the shin along the bones forward; |score| < 0.1 is unclear', rows }, null, 2));
