// Moderation for community courses. Every course starts 'pending' and shows in the gallery only after you approve it.
// Usage (needs `npx wrangler login` once; add LOCAL=1 to use the local test database):
//   node scripts/community-review.mjs list            pending courses and the newest approved ones
//   node scripts/community-review.mjs show 7          save the photo of course 7 to a file you can open, print its boxes
//   node scripts/community-review.mjs approve 7       show it in the gallery
//   node scripts/community-review.mjs reject 7        hide it for good
//   node scripts/community-review.mjs items           shared pieces waiting for a look (CC-247)
//   node scripts/community-review.mjs item-approve ID  show a held piece to everyone
//   node scripts/community-review.mjs item-remove ID   take one down and empty its files
// DB=conquercourse-preview picks the preview database (the default is the live one).
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const [cmd = 'list', arg] = process.argv.slice(2);
const where = process.env.LOCAL ? '--local' : '--remote';
const run = (sql) => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', process.env.DB ?? 'conquercourse-feedback', where, '--json', '--command', sql], { encoding: 'utf8' }))[0].results;
const id = Number(arg);
const itemId = /^[a-z0-9]{10}$/.test(arg ?? '') ? arg : '';
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
} else if (cmd === 'items') {
  const rows = run("SELECT id, kind, name, status, created_at, moderation, length(thumb) + length(glb) AS bytes FROM community_items WHERE status != 'removed' ORDER BY status = 'pending' DESC, created_at DESC LIMIT 30");
  if (!rows.length) console.log('No shared pieces yet.');
  for (const r of rows) console.log(`${r.id} [${r.status}] ${r.kind} "${r.name}" ${new Date(r.created_at * 1000).toISOString()} check=${r.moderation} (${Math.round(r.bytes / 1000)} KB)`);
} else if (cmd === 'item-approve' || cmd === 'item-remove') {
  if (!itemId) { console.error('Give the item code, e.g. item-approve k3x9a2mnpq'); process.exit(1); }
  run(cmd === 'item-approve' ? `UPDATE community_items SET status = 'approved' WHERE id = '${itemId}' AND status = 'pending'` : `UPDATE community_items SET status = 'removed', removed_at = unixepoch(), thumb = '', glb = '', meta = '{}' WHERE id = '${itemId}' AND status != 'removed'`);
  console.log(`item ${itemId}: ${cmd === 'item-approve' ? 'approved' : 'removed'}`);
} else {
  console.error('Use: list | show N | approve N | reject N | items | item-approve ID | item-remove ID');
  process.exit(1);
}
