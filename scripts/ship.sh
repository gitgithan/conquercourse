#!/usr/bin/env bash
# Ship the commits on the current branch through a pull request so Linear links and closes the issue by itself.
# Usage: scripts/ship.sh CC-12 --part   (links the issue, moves it to started)
#        scripts/ship.sh CC-12 --fixes  (links the issue and closes it when the pull request merges)
#        scripts/ship.sh CC-16 --fixes cc-16-rookies  (ship a branch a VM agent pushed)
# Linear's GitHub app only reacts to pull requests, not to commits pushed straight to main.
set -euo pipefail
issue="${1:?issue id, e.g. CC-12}"; mode="${2:---part}"; remote_branch="${3:-}"
# The owner's folder stays on main; agents ship from their own worktree (git worktree add ../conquercourse-<name> -b hanqi91/cc-n-name origin/main)
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] && [ "${ALLOW_MAIN_FOLDER:-}" != 1 ]; then
  echo "This is the owner's folder, which stays on main. Ship from a worktree (see CLAUDE.md), or set ALLOW_MAIN_FOLDER=1." >&2; exit 1
fi
# a third argument names a branch a VM agent pushed (e.g. cc-16-rookies): fetch it and ship it
if [ -n "$remote_branch" ]; then git fetch -q origin "$remote_branch"; git switch -q -C "$remote_branch" "origin/$remote_branch"; fi
word="Part of"; [ "$mode" = "--fixes" ] && word="Fixes"
branch="$(git branch --show-current)"
[ "$branch" = "main" ] && { echo "Work on a branch (git switch -c hanqi91/${issue,,}-short-name), not on main." >&2; exit 1; }
[ "${SKIP_QUICK:-}" = 1 ] || npm run test:quick --silent # SKIP_QUICK=1 when the tests already passed on the VM (the laptop is for playtesting)
git fetch -q origin main
git rebase -q origin/main
# privacy: every commit we push carries the GitHub noreply address, never a real email (the history is public later)
bad="$(git log origin/main..HEAD --format='%ae %ce' | tr ' ' '\n' | grep -v 'users.noreply.github.com$' | sort -u || true)"
if [ -n "$bad" ]; then echo "A commit carries a real email address. Set git config user.email to the GitHub noreply address, then amend (git rebase -r origin/main --exec 'git commit --amend --no-edit --reset-author')." >&2; exit 1; fi
# the same for what the messages say (an address, a home folder)
msgbad="$(git log origin/main..HEAD --format=%B | grep -Eio '[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}|/home/[a-z][a-z0-9_-]*/|/Users/[A-Za-z][A-Za-z0-9_-]*/' | grep -Eiv '@users\.noreply\.github\.com$|@anthropic\.com$|@example\.(com|org|invalid)$|/home/(user|runner|node|root|you|name)/' | sort -u || true)"
if [ -n "$msgbad" ]; then echo "A commit message holds an email or a home path. Reword it (git rebase -r origin/main --exec 'git commit --amend')." >&2; exit 1; fi
# CC-118 guard 1: never ship a conflict marker (one reached main inside src/main.ts once)
marked="$(git diff origin/main...HEAD -U0 -- src tests scripts docs | grep -E '^\+(<{7}|>{7})( |$)' | head -5 || true)"
if [ -n "$marked" ]; then echo "The change adds a conflict marker line; resolve it first:" >&2; echo "$marked" >&2; exit 1; fi
# CC-118 guard 2: a stale base once deleted 47 files in a ship; stop when more than 15 files are deleted unless ALLOW_BIG_DELETE=1
deleted="$(git diff --diff-filter=D --name-only origin/main...HEAD)"
ndel="$(printf '%s' "$deleted" | grep -c . || true)"
if [ "$ndel" -gt 15 ] && [ "${ALLOW_BIG_DELETE:-}" != 1 ]; then
  echo "This change deletes $ndel files against origin/main (limit 15). A stale base can do this. Files:" >&2; echo "$deleted" >&2
  echo "If the deletion is on purpose, run again with ALLOW_BIG_DELETE=1." >&2; exit 1
fi
git push -q -u origin HEAD --force-with-lease
title="$(git log -1 --format=%s | sed -E 's/ \((Part of|Fixes) CC-[0-9]+\)$//')"
if ! gh pr view "$branch" >/dev/null 2>&1; then
  gh pr create --base main --title "$title ($issue)" --body "$word $issue." >/dev/null
fi
gh pr merge "$branch" --rebase --delete-branch
# Only the main folder keeps `main` checked out; a ship worktree detaches, so it never blocks `git checkout main` in the owner's folder
git fetch -q origin main
if [ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ]; then
  git switch -q main 2>/dev/null && git pull -q --ff-only origin main || git switch -q --detach origin/main
else
  git switch -q --detach origin/main
fi
echo "shipped $issue ($word) from $branch"
