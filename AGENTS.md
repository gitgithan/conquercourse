# Agent entry point

Follow `CLAUDE.md` for project rules and required product context.

For code discovery across files, use the local Graphify trial:
- Run `bash tools/codegraph.sh refresh` on your first use in a worktree and after pulls, merges, branch changes, or relevant edits.
- Ask a scoped question: `bash tools/codegraph.sh query "stepWorld" --budget 1200`.
- Follow a symbol: `bash tools/codegraph.sh explain "stepWorld"`.
- Read the returned source locations before editing; graph edges are navigation hints, not proof.
- If a query misses relevant code, use targeted `rg` and source reads.
- Keep each worktree's graph separate; do not point a changing branch at another branch's mutable index.
- Never read the whole graph JSON into model context.
- Do not enable semantic extraction or paid labeling for this trial.

Generate local visualizations with `bash tools/codegraph.sh visualize` after refreshing.

Setup and limitations: `docs/codegraph.md`.
