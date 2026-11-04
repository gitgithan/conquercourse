#!/usr/bin/env bash
# Installs a post-checkout hook (this machine only, not tracked) that puts the owner's folder back on main when someone checks out another branch or commit there.
# It only acts in the main working tree and only when the tree is clean, so it never throws away work. Worktrees are untouched. Run once per machine.
set -euo pipefail
common="$(git rev-parse --path-format=absolute --git-common-dir)"
hook="$common/hooks/post-checkout"
mkdir -p "$common/hooks"
cat > "$hook" <<'H'
#!/usr/bin/env bash
# CC owner-folder guard: the main working tree stays on main.
[ "$3" = "1" ] || exit 0                          # branch checkouts only, not file checkouts
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] || exit 0   # worktrees are exempt
[ "$(git branch --show-current)" = "main" ] && exit 0
if [ -z "$(git status --porcelain)" ]; then
  echo "CC guard: the owner's folder stays on main, switching back (git checkout main)." >&2
  git checkout -q main && git pull -q --ff-only 2>/dev/null || true
else
  echo "CC guard: the owner's folder is not on main and has changes; run: git checkout main" >&2
fi
exit 0
H
chmod +x "$hook"
echo "installed $hook"
