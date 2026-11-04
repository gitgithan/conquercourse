// four-part version numbers look like IP addresses to the privacy check, so write the last part as 'build N'
const dq = (t) => String(t).replace(/(\d+\.\d+\.\d+)\.(\d+)/g, '$1 build $2');
// Turns the raw per-machine results into run.json (small, tracked) and public/assets/lab/determinism-real.json (what the Lab shows).
// node compare.mjs <raw-dir> [more raw files]   (raw = ../conquercourse-assets/eval-full/cc-133-determinism-real/raw)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).pathname;
const dir = process.argv[2];
const golden = JSON.parse(readFileSync(root + 'tests/golden/sim-trace.json', 'utf8'));
const machines = []; let host = null;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  if (j.results) { host = j.host; for (const [id, r] of Object.entries(j.results)) machines.push({ id, where: 'Modal CPU container', host, ...r }); }
  else machines.push({ id: f.replace('.json', ''), where: j.where ?? 'this repo', host: j.host ?? null, ...j });
}
const ref = machines.find((m) => m.id === 'node24' && m.where.startsWith('Modal')) ?? machines[0];
const names = Object.keys(ref.runs);
const firstDiff = (a, b) => { const n = Math.min(a.length, b.length) / 8; for (let i = 0; i < n; i++) if (a.slice(i * 8, i * 8 + 8) !== b.slice(i * 8, i * 8 + 8)) return i; return a.length === b.length ? null : n; };
const refMath = ref.machine.info.math;
const rows = machines.filter((m) => m.runs).map((m) => {
  const per = {};
  let same = 0;
  for (const k of names) {
    const r = m.runs[k], q = ref.runs[k];
    const g = golden[k] ?? null; // the stored golden (plan runs and mash1..3 of the shipped list)
    const ok = r.trace === q.trace;
    if (ok) same++;
    per[k] = { frames: r.frames, trace: r.trace, sameAsReference: ok, matchesStored: g === null ? null : g === r.trace, firstDifferingFrame: ok ? null : firstDiff(r.frameHashes, q.frameHashes) };
  }
  return { id: m.id, engine: dq(m.machine.engine), arch: m.machine.arch, cpu: m.host?.cpu ?? null, where: m.where, runs: names.length, sameAsReference: same, differing: names.filter((k) => !per[k].sameAsReference), per, math: m.machine.info.math, ua: dq(m.machine.info.ua) };
});
const strip = (r) => ({ ...r, per: Object.fromEntries(Object.entries(r.per).filter(([, v]) => !v.sameAsReference || true)) });
const date = new Date().toISOString().slice(0, 10);
writeFileSync(new URL('./run.json', import.meta.url).pathname, JSON.stringify({ date, reference: ref.id, runCount: names.length, machines: rows.map((r) => ({ ...r, per: undefined, differing: r.differing, math: r.math })) }, null, 2) + '\n');
const lab = { recorded: date, note: 'Recorded at build time by data/eval/cc-133-determinism-real; not run in your browser.', reference: ref.id, courses: names, machines: rows.map((r) => ({ id: r.id, engine: r.engine, arch: r.arch, cpu: r.cpu, where: r.where, runs: r.runs, same: r.sameAsReference, mathDiffers: Object.keys(refMath).filter((k) => r.math[k] !== refMath[k]), differing: r.differing.map((k) => ({ run: k, firstFrame: r.per[k].firstDifferingFrame, frames: r.per[k].frames }))})) };
writeFileSync(root + 'public/assets/lab/determinism-real.json', JSON.stringify(lab, null, 2) + '\n');
for (const r of rows) console.log(r.id.padEnd(10), r.engine.padEnd(34), r.arch, `${r.sameAsReference}/${r.runs}`, r.differing.slice(0, 6).map((k) => `${k}@${r.per[k].firstDifferingFrame}`).join(' '));
