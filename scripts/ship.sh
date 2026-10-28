#!/usr/bin/env bash
# Ship the commits on the current branch through a pull request so Linear links and closes the issue by itself.
# Usage: scripts/ship.sh CC-12 --part   (links the issue, moves it to started)
#        scripts/ship.sh CC-12 --fixes  (links the issue and closes it when the pull request merges)
#        scripts/ship.sh CC-16 --fixes cc-16-rookies  (ship a branch a VM agent pushed)
# Linear's GitHub app only reacts to pull requests, not to commits pushed straight to main.
set -euo pipefail
issue="${1:?issue id, e.g. CC-12}"; mode="${2:---part}"; remote_branch="${3:-}"
# a third argument names a branch a VM agent pushed (e.g. cc-16-rookies): fetch it and ship it
if [ -n "$remote_branch" ]; then git fetch -q origin "$remote_branch"; git switch -q -C "$remote_branch" "origin/$remote_branch"; fi
word="Part of"; [ "$mode" = "--fixes" ] && word="Fixes"
branch="$(git branch --show-current)"
[ "$branch" = "main" ] && { echo "Work on a branch (git switch -c hanqi91/${issue,,}-short-name), not on main." >&2; exit 1; }
[ "${SKIP_QUICK:-}" = 1 ] || npm run test:quick --silent # SKIP_QUICK=1 when the tests already passed on the VM (the laptop is for playtesting)
git fetch -q origin main
git rebase -q origin/main
git push -q -u origin HEAD --force-with-lease
title="$(git log -1 --format=%s | sed -E 's/ \((Part of|Fixes) CC-[0-9]+\)$//')"
if ! gh pr view "$branch" >/dev/null 2>&1; then
  gh pr create --base main --title "$title ($issue)" --body "$word $issue." >/dev/null
fi
gh pr merge "$branch" --rebase --delete-branch
# main may be checked out in another worktree (the owner's folder): then just move to the new origin/main
git fetch -q origin main
git switch -q main 2>/dev/null && git pull -q --ff-only origin main || git switch -q --detach origin/main
echo "shipped $issue ($word) from $branch"
