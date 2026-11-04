// The owner's folder (the main working tree) must stay on `main`. Exit 1 with a plain message when it does not.
// Run it by hand, from tests/owner-folder.test.ts, or through the post-checkout guard (scripts/install-owner-folder-guard.sh).
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
export function ownerFolderState() {
  const top = git('rev-parse', '--show-toplevel');
  const isMainTree = git('rev-parse', '--path-format=absolute', '--git-dir') === git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const branch = git('branch', '--show-current'); // empty when detached
  return { top, isMainTree, branch, ok: !isMainTree || branch === 'main' };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = ownerFolderState();
  if (!s.ok) {
    console.error(`The owner's folder is on ${s.branch || 'a detached commit'}, not main. Fix: git checkout main && git pull --ff-only. Agents work in their own worktree (see CLAUDE.md).`);
    process.exit(1);
  }
  console.log(s.isMainTree ? "ok: the owner's folder is on main" : 'ok: this is a worktree, not the owner folder');
}
