// npm run motion -- <move> [options]: motion on demand (CC-64), see docs/motion-pipeline.md.
// Needs Python with numpy and matplotlib (and `modal`, logged in, for Kimodo): CC_PY=/path/to/python overrides python3.
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (!args.length) { console.error('usage: npm run motion -- <move> [--cmu-index F] [--cmu DIR] [--kimodo DIR] [--no-generate] [--ship]\nmoves: see pipelines/moves.json'); process.exit(1); }
const r = spawnSync(process.env.CC_PY || 'python3', ['pipelines/motion_on_demand.py', ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
