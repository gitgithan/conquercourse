import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper
import { ownerFolderState } from '../scripts/check-owner-folder.mjs';

// CLAUDE.md: the owner's folder stays on main. In a worktree this passes; in the owner's folder it fails if someone checked out another branch or a detached commit.
describe('the owner folder stays on main', () => {
  it('the main working tree is on main (worktrees are exempt)', () => {
    const s = ownerFolderState() as { ok: boolean; branch: string };
    expect(s.ok, `the owner's folder is on ${s.branch || 'a detached commit'}: git checkout main && git pull --ff-only`).toBe(true);
  });
});
