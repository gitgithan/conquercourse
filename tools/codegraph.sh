#!/usr/bin/env bash
# Local, code-only Graphify index; each worktree owns its own generated graph.
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
cli=$(command -v graphify || true)
if [[ -z "$cli" && -x "${HOME}/.local/bin/graphify" ]]; then
  cli="${HOME}/.local/bin/graphify"
fi
if [[ -z "$cli" ]]; then
  echo 'Install Graphify: uv tool install "graphifyy[all]==0.9.99"' >&2
  exit 1
fi
command_name=${1:-query}
if [[ $# -gt 0 ]]; then shift; fi
case "$command_name" in
  refresh)
    "$cli" extract . --code-only --no-cluster --max-workers 2 "$@"
    ;;
  visualize)
    "$cli" cluster-only . --no-label --no-viz
    "$cli" export html --graph graphify-out/graph.json
    "$cli" tree --graph graphify-out/graph.json --root . --label ConquerCourse
    "$cli" export callflow-html --graph graphify-out/graph.json --lang en --output graphify-out/architecture.html
    ;;
  query|explain|path|affected|god-nodes)
    if [[ ! -f graphify-out/graph.json ]]; then
      echo 'Build this worktree index first: bash tools/codegraph.sh refresh' >&2
      exit 1
    fi
    "$cli" "$command_name" "$@" --graph graphify-out/graph.json
    ;;
  *) echo 'Usage: bash tools/codegraph.sh {refresh|visualize|query|explain|path|affected|god-nodes} [args]' >&2; exit 2 ;;
esac
