# Local code graph trial

The trial helps agents find source files during handovers and cross-file changes.
It does not replace the product spec, lessons, source reads, or tests.

## Setup

- Install the tested CLI once per machine: `uv tool install "graphifyy[all]==0.9.99"`.
- In each worktree, run `bash tools/codegraph.sh refresh`.
- Ask `bash tools/codegraph.sh query "stepWorld" --budget 1200`.
- Trace `bash tools/codegraph.sh path "searchIdealRun" "stepWorld"`.
- Refresh after pulls, merges, branch switches, and relevant source edits.
- The live graph in `graphify-out/` stays local and ignored; each worktree owns its graph.
- A snapshot of the views is tracked in `docs/codegraph/` (see "Tracked snapshot" below).
- A new worktree builds once; later agents in that worktree reuse its incremental cache.
- Do not refresh and query the same index concurrently.

## Cost and scope

- The wrapper uses local AST parsing with `--code-only --no-cluster`; it makes no model calls.
- There is no paid indexing step and no cloud subscription for this trial.
- Docs remain available through normal reads; no semantic document extraction is enabled.
- `.graphifyignore` excludes data, shipped assets, private notes, generated output and nested agent worktrees.
- Graph files can contain source snippets; the tracked snapshot holds only names, paths and line numbers from this public repo.
- Do not upload `graph.json` anywhere; it is about 8 MB and stays local.
- Do not install automatic Git hooks during this trial; worktrees share Git configuration.

## Initial checks

- Base revision: `75496cf7`; Graphify `0.9.76`.
- Initial extraction: 838 code inputs, 5,906 persisted nodes, 16,936 edges.
- Incremental refresh after adding the helper: 3.71 seconds, 16,937 edges.
- The query layer reports additional implicit nodes beyond persisted node counts.
- `stepWorld` query found the simulator, course mode, ideal-run planner, replay code and related tests.
- A path from `searchIdealRun` to `stepWorld` was found through the containing file and its import.
- That path is a structural connection, not proof of a direct function call.
- Broad wording such as "course editor rendering" returned many matches and truncated output.
- Prefer specific symbols and budgets around 800–1,500 tokens; narrow noisy results before increasing the budget.
- Initial SQL extraction was incomplete; the upgraded installation includes the SQL parser.
- Some code inputs yield no symbols; use targeted search for those files.
- Sandbox restrictions prevented parallel parser workers; sequential extraction succeeded.

## Judge the trial

- Compare representative handovers and fixes with and without graph queries.
- Record task completion, relevant files found, total agent token usage, elapsed time and refresh cost.
- Include failed queries and source verification in the comparison.
- No token savings percentage has been measured yet.
- Do not use Graphify's full-corpus comparison as evidence of savings against targeted searches.

## Remove

Delete the helper, ignore file and agent guidance, and remove the ignored `graphify-out/` directory in each worktree.

## Explore the codebase visually

- Installed version: Graphify 0.9.99 with all advertised extras.
- Run `bash tools/codegraph.sh refresh`, then `bash tools/codegraph.sh visualize`.
- Open `graphify-out/graph.html` for the relationship graph: search symbols, click nodes, and filter communities.
- Open `graphify-out/GRAPH_TREE.html` for folders, files, symbols and their relationships.
- Open `graphify-out/architecture.html` for architecture and call-flow diagrams.
- Read `graphify-out/GRAPH_REPORT.md` for hubs and community summaries.
- The default large-graph HTML is an overview of communities; the file tree is better for locating individual symbols.
- HTML views may load JavaScript libraries from public CDNs; the generated graph data stays in local files.
- Community clustering here uses `--no-label`, so no model calls are made and community names may be generic.

## Feature guide

| Feature | What it helps with | Enablement |
| --- | --- | --- |
| query, explain, path | Find symbols and trace structural relationships | Ready locally |
| affected | Explore reverse relationships before changing a symbol | Ready locally |
| god-nodes | Find highly connected architectural hubs | Ready locally |
| clustering and HTML/tree/call-flow views | Explore subsystem structure visually | Ready locally |
| SVG, GraphML, Obsidian/wiki exports | Export the index for other tools | Installed; generate on demand |
| SQL parsing | Include migration schema relationships | Ready; all 11 migration files indexed |
| watch | Refresh code indexes on edits | Installed; run per worktree when needed |
| graphify-mcp | Expose graph tools to an MCP client | Installed; client setup required |
| merge-graphs and global graph | Explore relationships across projects | Available; not configured |
| save-result and reflect | Record useful queries and derive handover lessons | Available; opt in deliberately |
| document/PDF/Office/image semantics | Connect prose and media to code | Extras installed; model backend required |
| video/audio | Transcribe and analyze recordings | Extras installed; model downloads/backend may be required |
| model community labels and deep extraction | Add semantic names and inferred connections | Backend required; cost depends on provider |
| Neo4j, FalkorDB, PostgreSQL | Use external graph stores or inspect a live database | Drivers installed; service configuration required |
| provider integrations | Choose local or hosted semantic models | SDKs installed; backend configuration required |
| Graphify Cloud | Hosted continuous indexing and integrations | Separate service; not enabled by local extras |

Installing extras does not activate paid APIs, connect accounts, download inference models, or enable Git hooks.

## Upgraded visualization results

- Graphify 0.9.99: 839 code inputs, 5,998 nodes and 16,878 persisted relationships before clustering.
- SQL: 30 nodes across all 11 migration files; verified in the generated graph.
- Clustering: 233 communities; Graphify reported 16,478 graph edges during clustering versus 16,878 input relationships.
- Relationship HTML: 233 community nodes and 1,045 cross-community connections.
- File/symbol tree: about 339 KB.
- Architecture export: 16 Mermaid diagrams and 15 call tables.
- The 42 zero-symbol inputs remain; installing extras does not guarantee symbol extraction from every script.
- The upgraded full rebuild took several minutes; a profiler sample showed manifest file hashing active near completion.
- The earlier 3.71-second refresh was measured on 0.9.76 and should not be assumed for this version.

## Model names and community drill-down

- All 233 communities now have names authored by the assistant in this chat from indexed paths and symbols, without a separate model API call.
- These are not Graphify backend-generated labels and no semantic source extraction was performed.
- Open `graphify-out/graph.html` and select a community to see purpose notes, filter member files and symbols, and follow connected communities in its sidebar.
- The main graph search also matches member files and symbols.
- No separate explorer page is needed.
- Community names come from each community's busiest files; each community lists its member files and symbols.
- Names and purpose notes are interpretations, not a full source review.
- Mixed script groups should not be treated as intentional architecture.
- Native Graphify label sidecars and membership signatures are saved for reuse.
- The explorer builder is `tools/community-explorer.py`; run with the Python interpreter from the Graphify environment.
- Its session-specific `community-names.txt` and generated notes stay under ignored `graphify-out/`.
- Regenerate/review names when community membership changes.
- Do not reuse the numeric name mapping after reclustering.
- Exporting HTML overwrites the embedded details; rerun the explorer builder after `graphify export html` to restore them.
- The builder embeds `tools/community-panel.js` and all community data into the one HTML file.

- Clicking a community highlights it, its immediate neighbors and only its incident edges.
- Other nodes, labels and edges dim; clicking the background resets the focus.
- Sidebar neighbor links and search selections also apply focus.

## Tracked snapshot

- Built 2026-11-01 from `main`: 8,471 nodes, 23,869 edges, 322 communities.
- `docs/codegraph/graph.html` is the drill-down view.
  - Click a community to see its purpose line, member files and symbols.
  - Use the filter box to narrow files and symbols.
  - File links point at the repo from this folder.
- `docs/codegraph/GRAPH_TREE.html` shows folders, files and symbols.
- `docs/codegraph/architecture.html` shows call-flow diagrams.
- `docs/codegraph/GRAPH_REPORT.md` lists hubs and communities.
- Community names come from `tools/name-communities.py`, which reads each community's busiest files; there are no model calls.
- Rebuild: `bash tools/codegraph.sh refresh`, `bash tools/codegraph.sh visualize`, `python3 tools/name-communities.py`, then `rm -f graphify-out/community-names.membership` and run `tools/community-explorer.py` with the Graphify tool's own Python.
- Refreshing takes about 15 minutes on a laptop for the first full build; later builds reuse the cache.
