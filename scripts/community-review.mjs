// Moderation for community courses. Every course starts 'pending' and shows in the gallery only after you approve it.
// Usage (needs `npx wrangler login` once; add LOCAL=1 to use the local test database):
//   node scripts/community-review.mjs list            pending courses and the newest approved ones
//   node scripts/community-review.mjs show 7          save the photo of course 7 to a file you can open, print its boxes
//   node scripts/community-review.mjs approve 7       show it in the gallery
//   node scripts/community-review.mjs reject 7        hide it for good
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const [cmd = 'list', arg] = process.argv.slice(2);
const where = process.env.LOCAL ? '--local' : '--remote';
const run = (sql) => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', where, '--json', '--command', sql], { encoding: 'utf8' }))[0].results;
const id = Number(arg);
const needId = () => { if (!Number.isInteger(id) || id < 1) { console.error('Give the course number, e.g. approve 7'); process.exit(1); } };

if (cmd === 'list') {
  const rows = run("SELECT id, ts, status, name, nick, reports, length(image) AS bytes FROM community WHERE status = 'pending' OR id IN (SELECT id FROM community WHERE status = 'approved' ORDER BY id DESC LIMIT 10) ORDER BY status, id DESC");
  if (!rows.length) console.log('No courses yet.');
  for (const r of rows) console.log(`#${r.id} [${r.status}] ${r.ts} "${r.name}" by ${r.nick} (${Math.round(r.bytes / 1000)} KB, ${r.reports} reports)`);
} else if (cmd === 'show') {
  needId();
  const [r] = run(`SELECT name, nick, status, boxes, image FROM community WHERE id = ${id}`);
  if (!r) { console.error('No such course.'); process.exit(1); }
  mkdirSync('test-results/community', { recursive: true });
  const file = `test-results/community/course-${id}.jpg`;
  writeFileSync(file, Buffer.from(r.image.replace(/^data:image\/jpeg;base64,/, ''), 'base64'));
  console.log(`"${r.name}" by ${r.nick} [${r.status}]\nphoto: ${file} (look for faces, people, private places before approving)\nboxes: ${r.boxes}`);
} else if (cmd === 'approve' || cmd === 'reject') {
  needId();
  run(`UPDATE community SET status = '${cmd === 'approve' ? 'approved' : 'rejected'}' WHERE id = ${id}`);
  console.log(`course ${id}: ${cmd === 'approve' ? 'approved' : 'rejected'}`);
} else {
  console.error('Use: list | show N | approve N | reject N');
  process.exit(1);
}
